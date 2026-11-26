/**
 * Integration tests against a real MongoDB.
 *
 * Run with:  MONGODB_URI=mongodb://127.0.0.1:27018 JWT_SECRET=<32+ chars> npm test
 *
 * These exercise the real HTTP surface (through supertest-free raw fetch
 * against a booted app) and the real database, because the bugs this suite
 * guards against — `$nin` type strictness, non-atomic status transitions,
 * NoSQL injection — only reproduce against actual MongoDB semantics.
 */

import { test, before, after, describe } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { createServer } from 'node:http'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-that-is-definitely-long-enough-32'
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018'
process.env.MONGODB_DB_NAME = 'cplab_test'

const { createApp } = await import('../app.js')
const userModel = (await import('../models/userModel.js')).default
const problemModel = (await import('../models/problemModel.js')).default
const practiceSetModel = (await import('../models/practiceSetModel.js')).default

let server
let baseUrl

before(async () => {
    await mongoose.connect(process.env.MONGODB_URI, {
        dbName: process.env.MONGODB_DB_NAME,
        serverSelectionTimeoutMS: 10000,
    })
    server = createServer(createApp())
    await new Promise(r => server.listen(0, '127.0.0.1', r))
    baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
    await mongoose.connection.dropDatabase()
    await mongoose.connection.close()
    server?.close()
})

// ─── helpers ──────────────────────────────────────────────────────────────────

let cookie = ''

const api = async (method, path, body) => {
    const headers = { 'Content-Type': 'application/json' }
    if (cookie) headers.Cookie = cookie
    const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) cookie = setCookie.split(';')[0]
    const text = await res.text()
    let json
    try { json = JSON.parse(text) } catch { json = { raw: text } }
    return { status: res.status, body: json }
}

// `contestId`+`index` is unique, so each seed run replaces the previous
// batch rather than colliding with it.
let seedCounter = 0

const seedProblems = async (count = 60) => {
    seedCounter++
    const base = 1000 + seedCounter * 1000
    const docs = Array.from({ length: count }, (_, i) => ({
        contestId: base + i,
        index: 'A',
        name: `Test Problem ${base + i}`,
        type: 'PROGRAMMING',
        rating: 800 + (i % 30) * 20,
        tags: ['dp'],
        solvedCount: 100,
        url: `https://codeforces.com/problemset/problem/${base + i}/A`,
        difficulty: 'easy',
    }))
    await problemModel.insertMany(docs)
    return problemModel.find({ contestId: { $gte: base } }).sort({ contestId: 1 }).lean()
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('health & boot', () => {
    test('GET /health reports the database state', async () => {
        const { status, body } = await api('GET', '/health')
        assert.equal(status, 200)
        assert.equal(body.database, 'connected')
    })

    test('unknown route returns 404 with the standard body shape', async () => {
        const { status, body } = await api('GET', '/api/nope')
        assert.equal(status, 404)
        assert.equal(body.success, false)
        assert.ok(typeof body.message === 'string')
    })
})

describe('auth', () => {
    test('rejects a request with no token with 401, not 200', async () => {
        const { status, body } = await api('GET', '/api/auth/me')
        assert.equal(status, 401, 'the frontend only redirects on 401')
        assert.equal(body.success, false)
    })

    test('rejects a forged token with 401 and no JWT internals in the message', async () => {
        cookie = 'token=not-a-real-jwt'
        const { status, body } = await api('GET', '/api/auth/me')
        assert.equal(status, 401)
        assert.ok(!/jwt/i.test(body.message), `leaked JWT detail: ${body.message}`)
        cookie = ''
    })

    test('registers a user and sets an httpOnly cookie', async () => {
        const { status, body } = await api('POST', '/api/auth/register', {
            name: 'Tester', email: 'Tester@Example.com', password: 'correct horse battery',
        })
        assert.equal(status, 201)
        assert.equal(body.success, true)
        assert.ok(cookie.startsWith('token='))
    })

    test('duplicate registration returns 409', async () => {
        const { status, body } = await api('POST', '/api/auth/register', {
            name: 'Tester', email: 'tester@example.com', password: 'correct horse battery',
        })
        assert.equal(status, 409)
        assert.equal(body.success, false)
    })

    test('rejects a short password with 400', async () => {
        const { status, body } = await api('POST', '/api/auth/register', {
            name: 'Short', email: 'short@example.com', password: 'abc',
        })
        assert.equal(status, 400)
        assert.equal(body.success, false)
    })

    test('rejects a malformed email with 400', async () => {
        const { status } = await api('POST', '/api/auth/register', {
            name: 'Bad', email: 'not-an-email', password: 'correct horse battery',
        })
        assert.equal(status, 400)
    })

    test('NoSQL injection via an object email does not match a user', async () => {
        // The classic operator injection: if `email` reached `findOne` as an
        // object, this would match the first user in the collection.
        const { status, body } = await api('POST', '/api/auth/login', {
            email: { $ne: null },
            password: 'correct horse battery',
        })
        assert.equal(status, 400, 'an object email must be rejected as invalid input')
        assert.equal(body.success, false)
    })

    test('NoSQL injection via $gt email does not match a user', async () => {
        const { status } = await api('POST', '/api/auth/login', {
            email: { $gt: '' },
            password: 'correct horse battery',
        })
        assert.equal(status, 400)
    })

    test('login with the wrong password returns 401', async () => {
        const { status, body } = await api('POST', '/api/auth/login', {
            email: 'tester@example.com', password: 'wrong password entirely',
        })
        assert.equal(status, 401)
        assert.equal(body.success, false)
    })

    test('login does not reveal whether an email is registered', async () => {
        const unknown = await api('POST', '/api/auth/login', {
            email: 'nobody@example.com', password: 'wrong password entirely',
        })
        const known = await api('POST', '/api/auth/login', {
            email: 'tester@example.com', password: 'wrong password entirely',
        })
        assert.equal(unknown.body.message, known.body.message,
            'different messages for unknown-user and wrong-password are an enumeration oracle')
    })

    test('login with correct credentials succeeds', async () => {
        const { status, body } = await api('POST', '/api/auth/login', {
            email: 'tester@example.com', password: 'correct horse battery',
        })
        assert.equal(status, 200)
        assert.equal(body.success, true)
    })

    test('GET /auth/me does not ship the solved-problem arrays', async () => {
        const { status, body } = await api('GET', '/api/auth/me')
        assert.equal(status, 200)
        assert.ok(body.user)
        assert.equal(body.user.solvedProblems, undefined)
        assert.equal(body.user.attemptedProblems, undefined)
        assert.equal(body.user.password, undefined)
    })

    test('update-profile rejects a handle with illegal characters', async () => {
        const { status } = await api('PUT', '/api/auth/update-profile', {
            codeforcesHandle: 'bad handle/../etc',
        })
        assert.equal(status, 400)
    })
})

describe('suggestions — the $nin exclusion', () => {
    test('never returns a problem the user has already solved', async () => {
        // A small, exactly-known candidate set. With so few problems the
        // `$sample` pool covers all of them, so a broken exclusion is
        // guaranteed to surface rather than depending on luck.
        const problems = await seedProblems(8)

        const user = await userModel.findOne({ email: 'tester@example.com' })
        const solvedId = problems[0]._id
        const attemptedId = problems[1]._id

        // These are exactly what the buggy code stored: stringified ids.
        user.solvedProblems = [String(solvedId)]
        user.attemptedProblems = [String(attemptedId)]
        await user.save()

        // An explicit rating range that contains every seeded problem, so
        // rating filters cannot mask the exclusion.
        const ratings = problems.map(p => p.rating)
        const min = Math.min(...ratings)
        const max = Math.max(...ratings)

        const { status, body } = await api('GET',
            `/api/problems/suggestions?minRating=${min}&maxRating=${max}&count=50`)

        assert.equal(status, 200)
        assert.ok(body.suggestions.length > 0, 'no suggestions were produced, so the test proves nothing')

        const returned = body.suggestions.map(p => String(p._id))
        assert.ok(!returned.includes(String(solvedId)),
            'a solved problem was returned — the $nin filter did not work')
        assert.ok(!returned.includes(String(attemptedId)),
            'an attempted problem was returned — the $nin filter did not work')

        // The rest of the set must still be returned — otherwise the test
        // could pass by returning nothing at all.
        assert.equal(returned.length, problems.length - 2,
            'the exclusion removed the wrong number of problems')

        // And the exclusion must be visible in the reported metadata.
        assert.equal(body.meta.excluded, 2)
    })

    test('clamps a hostile count instead of trusting it', async () => {
        const { status, body } = await api('GET', '/api/problems/suggestions?count=100000')
        assert.equal(status, 200)
        assert.ok(body.suggestions.length <= 50, `returned ${body.suggestions.length} suggestions`)
    })

    test('clamps a hostile search limit instead of trusting it', async () => {
        // An unclamped limit let a client ask for the entire problem bank
        // in a single request.
        const { status, body } = await api('GET', '/api/problems/search?limit=99999&page=1')
        assert.equal(status, 200)
        assert.ok(body.problems.length <= 100, `returned ${body.problems.length} problems`)
    })

    test('rejects a non-numeric count by falling back to the default', async () => {
        const { status, body } = await api('GET', '/api/problems/suggestions?count=abc')
        assert.equal(status, 200)
        assert.ok(body.suggestions.length <= 20)
    })

    test('excludes solved problems even when they are stored as strings', async () => {
        // `$nin` is type-strict: a hex string never matches an ObjectId
        // `_id`. The exclusion list used to be stringified, so solved
        // problems were still being served — while `meta.excluded` happily
        // reported the right number, which made the bug invisible.
        const problems = await seedProblems(6)
        const user = await userModel.findOne({ email: 'tester@example.com' })
        const solvedId = problems[0]._id
        // Store it the way the buggy code did: as a string.
        user.solvedProblems = [String(solvedId)]
        user.attemptedProblems = []
        await user.save()

        const ratings = problems.map(p => p.rating)
        const min = Math.min(...ratings)
        const max = Math.max(...ratings)

        const { status, body } = await api('GET',
            `/api/problems/suggestions?minRating=${min}&maxRating=${max}&count=50`)

        assert.equal(status, 200)
        const returned = body.suggestions.map(p => String(p._id))
        assert.ok(!returned.includes(String(solvedId)),
            'a solved problem was returned — the $nin filter is not type-safe')
    })
})

describe('suggestions — the strategy windows', () => {
    /**
     * Seed problems across a spread of rating levels, with several problems
     * per level so the tie-break inside a level is exercised.
     */
    const seedSpread = async (levels, perLevel = 6) => {
        seedCounter++
        const base = 1000 + seedCounter * 1000
        const docs = []
        for (const rating of levels) {
            for (let i = 0; i < perLevel; i++) {
                docs.push({
                    contestId: base + docs.length,
                    index: 'A',
                    name: `Spread ${rating} #${i}`,
                    type: 'PROGRAMMING',
                    rating,
                    tags: ['dp'],
                    // Popularity varies WITHIN a level, so a popularity-based
                    // tie-break would visibly favour one level over another.
                    solvedCount: 10 + i,
                    url: `https://codeforces.com/problemset/problem/${base + docs.length}/A`,
                    difficulty: rating <= 1200 ? 'easy' : rating <= 1900 ? 'medium' : 'hard',
                })
            }
        }
        await problemModel.insertMany(docs)
        return base
    }

    /** Set the level the suggestions are matched against. */
    const setLevel = async (rating) => {
        const user = await userModel.findOne({ email: 'tester@example.com' })
        user.cfRating = 0
        user.estimatedRating = rating
        await user.save()
    }

    test('upsolve stays BELOW the user rating and spread across levels', async () => {
        await seedSpread([1000, 1100, 1200, 1300, 1400])
        await setLevel(1450)

        const { status, body } = await api('GET', '/api/problems/suggestions?strategy=upsolve&count=20')
        assert.equal(status, 200)
        assert.ok(body.suggestions.length > 0, 'no suggestions were produced, so the test proves nothing')

        for (const p of body.suggestions) {
            assert.ok(p.rating < 1450, `upsolve returned a ${p.rating} problem, which is not below the user's 1450`)
        }

        // The old code scored against `userRating + 100`, which sits outside
        // the upsolve window, so the whole page filled with ONE rating.
        const distinct = new Set(body.suggestions.map(p => p.rating))
        assert.ok(distinct.size >= 3,
            `upsolve returned only ${distinct.size} distinct rating(s) (${[...distinct]}) — the results collapsed onto one level`)
    })

    test('stretch stays ABOVE the user rating and spread across levels', async () => {
        await seedSpread([1700, 1800, 1900, 2000, 2100])
        await setLevel(1450)

        const { status, body } = await api('GET', '/api/problems/suggestions?strategy=stretch&count=20')
        assert.equal(status, 200)
        assert.ok(body.suggestions.length > 0, 'no suggestions were produced, so the test proves nothing')

        for (const p of body.suggestions) {
            assert.ok(p.rating > 1450, `stretch returned a ${p.rating} problem, which is not above the user's 1450`)
        }

        const distinct = new Set(body.suggestions.map(p => p.rating))
        assert.ok(distinct.size >= 3,
            `stretch returned only ${distinct.size} distinct rating(s) (${[...distinct]}) — the results collapsed onto one level`)
    })

    test('smart brackets the user rating and spread across levels', async () => {
        await seedSpread([1300, 1400, 1500, 1600, 1700])
        await setLevel(1450)

        const { status, body } = await api('GET', '/api/problems/suggestions?strategy=smart&count=20')
        assert.equal(status, 200)

        const distinct = new Set(body.suggestions.map(p => p.rating))
        assert.ok(distinct.size >= 3,
            `smart returned only ${distinct.size} distinct rating(s) (${[...distinct]}) — the results collapsed onto one level`)
    })

    test('the target rating sits inside the strategy window', async () => {
        await seedSpread([1000, 1200, 1400, 1600, 1800])
        await setLevel(1450)

        for (const strategy of ['smart', 'upsolve', 'stretch']) {
            const { body } = await api('GET', `/api/problems/suggestions?strategy=${strategy}&count=10`)
            const { rMin, rMax, targetRating } = body.meta
            assert.ok(targetRating >= rMin && targetRating <= rMax,
                `${strategy}: target ${targetRating} is outside its own window ${rMin}–${rMax}`)
        }
    })

    test('random ignores the rating entirely', async () => {
        await seedSpread([900, 1500, 3000], 10)
        await setLevel(1450)

        // Draw many times: with the rating removed from the decision, the
        // far-away levels must show up. Previously the rating term was worth
        // up to 100 points against a random term worth 50, so a rating-900
        // problem could never win against a rating-3000 one.
        const seen = new Set()
        for (let i = 0; i < 25; i++) {
            const { body } = await api('GET', '/api/problems/suggestions?strategy=random&count=20')
            for (const p of body.suggestions) seen.add(p.rating)
        }

        assert.ok(seen.size >= 2,
            `random only ever returned ${seen.size} rating level(s) (${[...seen]}) — the rating is still ranking the results`)
        assert.ok(seen.has(900) || seen.has(3000),
            `random never returned a problem far from the user's level (saw ${[...seen]})`)
    })

    test('a handle-less user is matched to their own estimated rating', async () => {
        await seedSpread([1000, 1200, 1400, 1600, 1800])
        await setLevel(1000)

        const { body } = await api('GET', '/api/problems/suggestions?strategy=stretch&count=20')
        assert.equal(body.meta.userRating, 1000,
            'the estimated rating was ignored — the hardcoded 1200 fallback was used instead')
        for (const p of body.suggestions) {
            assert.ok(p.rating > 1000, `a 1000-rated user received a ${p.rating} problem`)
        }
    })

    test('the estimated rating can be saved and is clamped', async () => {
        const { status, body } = await api('PUT', '/api/auth/update-profile', { estimatedRating: 1650 })
        assert.equal(status, 200)
        assert.equal(body.success, true)
        assert.equal(body.user.estimatedRating, 1650)

        // Out of range: clamped, not rejected outright.
        const { body: clamped } = await api('PUT', '/api/auth/update-profile', { estimatedRating: 99999 })
        assert.equal(clamped.user.estimatedRating, 4000)
    })
})

describe('search', () => {
    test('hideSolved excludes solved problems', async () => {
        const problems = await seedProblems(10)
        const user = await userModel.findOne({ email: 'tester@example.com' })
        user.solvedProblems = [problems[0]._id]
        await user.save()

        const { status, body } = await api('GET', '/api/problems/search?hideSolved=true&limit=100')
        assert.equal(status, 200)
        const ids = body.problems.map(p => String(p._id))
        assert.ok(!ids.includes(String(problems[0]._id)))
    })

    test('clamps limit and page', async () => {
        const { status, body } = await api('GET', '/api/problems/search?limit=99999&page=1')
        assert.equal(status, 200)
        assert.ok(body.problems.length <= 100)
    })

    test('treats a regex metacharacter query literally', async () => {
        const { status, body } = await api('GET', '/api/problems/search?q=.*')
        assert.equal(status, 200)
        // `.*` escaped matches only a literal dot-star, not every problem.
        assert.ok(body.total < 60, `regex was not escaped — matched ${body.total} problems`)
    })

    test('a multi-tag filter requires EVERY tag, not just one of them', async () => {
        // Four problems: two carry both tags, one carries only `dp`, and one
        // carries only `greedy`. The filter must return just the two.
        seedCounter++
        const base = 1000 + seedCounter * 1000
        await problemModel.insertMany([
            { contestId: base + 1, index: 'A', name: 'Both',       type: 'PROGRAMMING', rating: 1200, tags: ['dp', 'greedy'], solvedCount: 10, difficulty: 'easy' },
            { contestId: base + 2, index: 'A', name: 'Both Again', type: 'PROGRAMMING', rating: 1200, tags: ['greedy', 'dp'], solvedCount: 10, difficulty: 'easy' },
            { contestId: base + 3, index: 'A', name: 'Only DP',    type: 'PROGRAMMING', rating: 1200, tags: ['dp'],            solvedCount: 10, difficulty: 'easy' },
            { contestId: base + 4, index: 'A', name: 'Only Greedy',type: 'PROGRAMMING', rating: 1200, tags: ['greedy'],       solvedCount: 10, difficulty: 'easy' },
        ])

        const { status, body } = await api('GET', '/api/problems/search?tags=dp,greedy&limit=100')
        assert.equal(status, 200)

        const matched = body.problems.filter(p =>
            p.tags.includes('dp') && p.tags.includes('greedy'))
        const returned = body.problems.filter(p =>
            p.contestId >= base && p.contestId <= base + 4)

        // The four seeded problems must not leak in through the "only one
        // tag" path. `$in` would have returned all four.
        assert.equal(returned.length, 2,
            `expected only the 2 problems carrying both tags, got ${returned.length}`)
        assert.equal(matched.length, returned.length,
            'a returned problem is missing one of the requested tags')
    })

    test('the same all-tags rule applies to suggestions', async () => {
        const { status, body } = await api('GET', '/api/problems/suggestions?strategy=smart&count=50&tags=dp,greedy')
        assert.equal(status, 200)
        const bad = (body.suggestions || []).filter(p =>
            !(p.tags || []).includes('dp') || !(p.tags || []).includes('greedy'))
        assert.equal(bad.length, 0,
            `${bad.length} suggestions are missing one of the requested tags`)
    })
})

describe('practice sets', () => {
    test('creating a set from filters excludes solved problems', async () => {
        const problems = await seedProblems(40)
        const user = await userModel.findOne({ email: 'tester@example.com' })
        user.solvedProblems = [String(problems[0]._id), String(problems[1]._id)]
        await user.save()

        const { status, body } = await api('POST', '/api/practicesets', {
            title: 'Test Set',
            filters: { minRating: 800, maxRating: 3500, count: 20 },
        })
        assert.equal(status, 201)

        const ids = body.practiceSet.problems.map(p => String(p.problem._id))
        assert.ok(!ids.includes(String(problems[0]._id)), 'a solved problem was added to a new set')
        assert.ok(!ids.includes(String(problems[1]._id)), 'a solved problem was added to a new set')
    })

    test('marking a problem solved updates the user counters', async () => {
        const created = await api('POST', '/api/practicesets', {
            title: 'Counter Set', filters: { minRating: 800, maxRating: 3500, count: 3 },
        })
        const ps = created.body.practiceSet
        // The route addresses the *entry* within the set, not the problem.
        const entryId = String(ps.problems[0]._id)
        const problemId = String(ps.problems[0].problem._id)

        const userBefore = await userModel.findOne({ email: 'tester@example.com' })
        const solvedBefore = userBefore.stats.totalSolved

        const { status } = await api('PUT', `/api/practicesets/${ps._id}/problems/${entryId}`, {
            status: 'solved',
        })
        assert.equal(status, 200)

        const userAfter = await userModel.findOne({ email: 'tester@example.com' })
        assert.equal(userAfter.stats.totalSolved, solvedBefore + 1)
        assert.ok(userAfter.solvedProblems.some(id => String(id) === problemId),
            'the problem was not added to solvedProblems')
    })

    test('marking the same problem solved twice does not double-count', async () => {
        const created = await api('POST', '/api/practicesets', {
            title: 'Idempotent Set', filters: { minRating: 800, maxRating: 3500, count: 3 },
        })
        const ps = created.body.practiceSet
        const entryId = String(ps.problems[0]._id)

        await api('PUT', `/api/practicesets/${ps._id}/problems/${entryId}`, { status: 'solved' })
        const userAfterFirst = await userModel.findOne({ email: 'tester@example.com' })

        await api('PUT', `/api/practicesets/${ps._id}/problems/${entryId}`, { status: 'solved' })
        const userAfterSecond = await userModel.findOne({ email: 'tester@example.com' })

        assert.equal(userAfterSecond.stats.totalSolved, userAfterFirst.stats.totalSolved,
            're-solving the same problem incremented the counter again')
    })

    test('resetting a problem to unsolved reverses the credit', async () => {
        const created = await api('POST', '/api/practicesets', {
            title: 'Reversible Set', filters: { minRating: 800, maxRating: 3500, count: 3 },
        })
        const ps = created.body.practiceSet
        const entryId = String(ps.problems[0]._id)
        const problemId = String(ps.problems[0].problem._id)

        await api('PUT', `/api/practicesets/${ps._id}/problems/${entryId}`, { status: 'solved' })
        const userAfterSolve = await userModel.findOne({ email: 'tester@example.com' })

        await api('PUT', `/api/practicesets/${ps._id}/problems/${entryId}`, { status: 'unsolved' })
        const userAfterReset = await userModel.findOne({ email: 'tester@example.com' })

        assert.equal(userAfterReset.stats.totalSolved, userAfterSolve.stats.totalSolved - 1,
            'the solved counter was not decremented on reset')
        assert.ok(!userAfterReset.solvedProblems.some(id => String(id) === problemId),
            'the problem was left in solvedProblems after a reset')
    })

    test('resetting a solved problem clears isCompleted on the set', async () => {
        const problems = await seedProblems(3)
        const created = await api('POST', '/api/practicesets', {
            title: 'Complete Set', problemIds: problems.map(p => String(p._id)),
        })
        const ps = created.body.practiceSet

        for (const entry of ps.problems) {
            await api('PUT', `/api/practicesets/${ps._id}/problems/${entry._id}`, { status: 'solved' })
        }

        const completed = await practiceSetModel.findById(ps._id)
        assert.equal(completed.isCompleted, true)
        assert.ok(completed.completedAt)

        await api('PUT', `/api/practicesets/${ps._id}/problems/${ps.problems[0]._id}`, { status: 'unsolved' })

        const reset = await practiceSetModel.findById(ps._id)
        assert.equal(reset.isCompleted, false, 'isCompleted was not cleared')
        assert.equal(reset.completedAt, undefined, 'completedAt was not cleared')
    })

    test('rejects an invalid status with 400', async () => {
        const created = await api('POST', '/api/practicesets', {
            title: 'Status Set', filters: { minRating: 800, maxRating: 3500, count: 2 },
        })
        const ps = created.body.practiceSet
        const { status } = await api('PUT', `/api/practicesets/${ps._id}/problems/${ps.problems[0]._id}`, {
            status: 'definitely-not-a-status',
        })
        assert.equal(status, 400)
    })

    test('returns 404 for another user’s set', async () => {
        const { status } = await api('GET', '/api/practicesets/64b7f9f2e1a2b3c4d5e6f7a8')
        assert.equal(status, 404)
    })

    test('returns 404 for a malformed set id instead of throwing', async () => {
        const { status } = await api('GET', '/api/practicesets/not-an-object-id')
        assert.equal(status, 404)
    })
})

describe('rate limiting', () => {
    test('login attempts are throttled', async () => {
        let lastStatus
        for (let i = 0; i < 15; i++) {
            const r = await api('POST', '/api/auth/login', {
                email: 'ratelimit@example.com', password: 'wrong password entirely',
            })
            lastStatus = r.status
        }
        assert.equal(lastStatus, 429, 'the login endpoint was never throttled')
    })
})

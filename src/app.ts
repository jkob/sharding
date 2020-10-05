import Koa from "koa"
import Router from "koa-router"
import Knex from "knex"
import HashRing from "hashring"
import { createHash, randomInt } from "crypto"
import { green, magentaBright } from "chalk"

const app = new Koa()
const router = new Router()

const PORT = process.env.PORT ?? 3000

const db_names = ["Winterfox", "Koala", "Lynx"]

// Connections init
interface ConnectionsInterface {
    [index : string]: Knex
}
const connections = db_names.reduce((total : ConnectionsInterface, name) => {
    total[name] = Knex({
        client: "sqlite3",
        connection: {
            filename: `db-${name}.sqlite`
        },
        useNullAsDefault: true
    })
    return total
}, {})

async function init(){
    // Schema setup
    await Promise.all(
        Object.keys(connections).map(
            async key => {
                if(!await connections[key].schema.hasTable("shortener")){
                    return connections[key].schema.createTableIfNotExists("shortener", t => {
                        t.increments("id").primary()
                        t.text("url").notNullable()
                        t.text("token").unique().notNullable()
                        t.timestamps(true, true)
                    }).catch(err => console.error(err))
                }
            }
    ))
}

init()


const HR = new HashRing(db_names)

router
    .get("/", async (ctx, next) => {
        // List all tokens
        const results = await Promise.all(
            Object.keys(connections).map(key => 
                connections[key]("shortener").select(["token", "url"])
            )
        )

        const flatResults = results.reduce((total, current) => {
            total = total.concat(current)
            return total
        }, [])
        
        ctx.status = 200
        ctx.body = {
            message: "OK",
            status: 200,
            data: flatResults
        }

        await next()
    })
    .get("/:token", async (ctx, next) => {
        try {
            // Fetch token from DB
            // If token exists, redirect to url
            const { token } = ctx.params
            if(!token) throw Error("Missing required input")

            const db = HR.get(token)
            const [{ url }] = await connections[db]("shortener").select(["url"]).where("token", token)

            ctx.status = 301
            ctx.redirect(url)
        } catch(e){
            console.error(e)
            switch(e){
                case "Missing required input":
                    ctx.throw(400, e)
                    break
                default:
                    ctx.throw(500)
                    break
            }
        } finally {
            await next()
        }
    })
    .post("/", async (ctx, next) => {
        try {
            // Get token from client
            const { url } = ctx.query
            if (!url) throw Error("Missing required input")
            // Hash, to get the token
            const token = createHash("sha256").update(url + randomInt(10000)).digest("base64").substr(0, 8)
            // Save to shard
            const db = HR.get(token)
            const [ id ] = await connections[db]("shortener").insert({
                url,
                token
            })

            ctx.status = 200
            ctx.body = {
                status: 200,
                message: "OK",
                data: {
                    id,
                    url,
                    token,
                    db
                }
            }
            
        } catch(e){
            console.error(e)
            switch(e){
                case "Missing required input":
                    ctx.throw(400, e)
                    break
                default:
                    ctx.throw(500)
            }
        } finally {
            await next()
        }
    })

app
    .use(async (ctx, next) => {
        const start = Date.now()
        await next()
        const time = Date.now() - start
        ctx.set("X-Response-Time", `${time}ms`)
        console.log(green(`${ctx.request.path} ${ctx.status} ${time}ms`))
    })
    .use(router.routes())
    .use(router.allowedMethods())
    .listen(PORT, () => console.log(magentaBright(`Server running at :${PORT}`)))

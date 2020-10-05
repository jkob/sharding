"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const koa_1 = __importDefault(require("koa"));
const koa_router_1 = __importDefault(require("koa-router"));
const knex_1 = __importDefault(require("knex"));
const hashring_1 = __importDefault(require("hashring"));
const crypto_1 = require("crypto");
const chalk_1 = require("chalk");
const app = new koa_1.default();
const router = new koa_router_1.default();
const PORT = (_a = process.env.PORT) !== null && _a !== void 0 ? _a : 3000;
const db_names = ["Winterfox", "Koala", "Lynx"];
const connections = db_names.reduce((total, name) => {
    total[name] = knex_1.default({
        client: "sqlite3",
        connection: {
            filename: `db-${name}.sqlite`
        },
        useNullAsDefault: true
    });
    return total;
}, {});
function init() {
    return __awaiter(this, void 0, void 0, function* () {
        // Schema setup
        yield Promise.all(Object.keys(connections).map((key) => __awaiter(this, void 0, void 0, function* () {
            if (!(yield connections[key].schema.hasTable("shortener"))) {
                return connections[key].schema.createTableIfNotExists("shortener", t => {
                    t.increments("id").primary();
                    t.text("url").notNullable();
                    t.text("token").unique().notNullable();
                    t.timestamps(true, true);
                }).catch(err => console.error(err));
            }
        })));
    });
}
init();
const HR = new hashring_1.default(db_names);
router
    .get("/", (ctx, next) => __awaiter(void 0, void 0, void 0, function* () {
    // List all tokens
    const results = yield Promise.all(Object.keys(connections).map(key => connections[key]("shortener").select(["token", "url"])));
    const flatResults = results.reduce((total, current) => {
        total = total.concat(current);
        return total;
    }, []);
    ctx.status = 200;
    ctx.body = {
        message: "OK",
        status: 200,
        data: flatResults
    };
    yield next();
}))
    .get("/:token", (ctx, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Fetch token from DB
        // If token exists, redirect to url
        const { token } = ctx.params;
        if (!token)
            throw Error("Missing required input");
        const db = HR.get(token);
        const [{ url }] = yield connections[db]("shortener").select(["url"]).where("token", token);
        ctx.status = 301;
        ctx.redirect(url);
    }
    catch (e) {
        console.error(e);
        switch (e) {
            case "Missing required input":
                ctx.throw(400, e);
                break;
            default:
                ctx.throw(500);
                break;
        }
    }
    finally {
        yield next();
    }
}))
    .post("/", (ctx, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get token from client
        const { url } = ctx.query;
        if (!url)
            throw Error("Missing required input");
        // Hash, to get the token
        const token = crypto_1.createHash("sha256").update(url + crypto_1.randomInt(10000)).digest("base64").substr(0, 8);
        // Save to shard
        const db = HR.get(token);
        const [id] = yield connections[db]("shortener").insert({
            url,
            token
        });
        ctx.status = 200;
        ctx.body = {
            status: 200,
            message: "OK",
            data: {
                id,
                url,
                token,
                db
            }
        };
    }
    catch (e) {
        console.error(e);
        switch (e) {
            case "Missing required input":
                ctx.throw(400, e);
                break;
            default:
                ctx.throw(500);
        }
    }
    finally {
        yield next();
    }
}));
app
    .use((ctx, next) => __awaiter(void 0, void 0, void 0, function* () {
    const start = Date.now();
    yield next();
    const time = Date.now() - start;
    ctx.set("X-Response-Time", `${time}ms`);
    console.log(chalk_1.green(`${ctx.request.path} ${ctx.status} ${time}ms`));
}))
    .use(router.routes())
    .use(router.allowedMethods())
    .listen(PORT, () => console.log(chalk_1.magentaBright(`Server running at :${PORT}`)));

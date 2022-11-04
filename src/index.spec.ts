import 'dotenv/config' // TODO - test env
import { AfterAll, BeforeAll, expect, Test, TestSuite } from 'testyts';
import NewServer from '../proto/autogenerated/ts/express_server'
import NewClient from '../proto/autogenerated/ts/http_client'
import methods from './services/serverMethods';
import serverOptions from './auth';
const testPort = 4000
const server = NewServer(methods, { ...serverOptions, throwErrors: true })
const client = NewClient({
    baseUrl: `http://localhost:${testPort}`,
    retrieveAdminAuth: async () => (""),
    retrieveGuestAuth: async () => (""),
    retrieveUserAuth: async () => (""),
    decryptCallback: async (b) => b,
    encryptCallback: async (b) => b,
    deviceId: "device0"
})
@TestSuite()
export class ServerTestSuite {
    @BeforeAll()
    startServer() {
        server.Listen(testPort)
    }
    @AfterAll()
    stopServer() {
        server.Close()
    }
    @Test()
    async health() {
        await client.Health()
    }

    @Test()
    async getInfo() {
        console.log(await client.LndGetInfo({ node_id: 0 }))
    }
}
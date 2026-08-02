import { db } from "../src/db";
import { plannedWorkouts } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("Deletando treinos antigos...");
    await db.delete(plannedWorkouts).execute();
    console.log("Banco limpo.");
}

main().catch(console.error);

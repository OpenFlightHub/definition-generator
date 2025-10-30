import { generateApiTypesAndSchemas } from "./api";
import { generateDatabaseTypesAndSchemas } from "./database";
import deasync from "deasync";

deasync(async ()=>{
    await generateDatabaseTypesAndSchemas()

    await generateApiTypesAndSchemas()

    console.log('done')
    process.exit(0)

})()

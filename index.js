#!/usr/bin/env node

const { extractSheets } = require("spreadsheet-to-json");
const fs = require('fs');
const ora = require('ora');
const spinner = ora('translation spreadsheet to json').start();

// it assumes that generate file will be in src/i18n

const ROOT_FIELD = 'id';

const CONFIGURATION = require('./translasheetrc.json');
const DEFAULT_OUTPUT_DIR = "./src/i18n/";
const DEFAULT_CREDENTIAL_SOURCE = './credential.json'


const CREDENTIAL_KEY = CONFIGURATION["credential-key"] || DEFAULT_CREDENTIAL_SOURCE

// Error message for required directory
const ERROR_MESSAGE_CONFIGURATION = {
    "spreadsheet-key": "spreadsheet id is required for source",
    "sheet-name": "sheet name is required for list translation"
}

const OUTPUT_DIR = CONFIGURATION["output-dir"] || DEFAULT_OUTPUT_DIR;


// Check configuration
Object.entries(ERROR_MESSAGE_CONFIGURATION).forEach(
    ([key, value]) => {
        if (!CONFIGURATION.hasOwnProperty(key)) {
            spinner.stop()
            spinner.error("error")
            throw ERROR_MESSAGE_CONFIGURATION[key]
        }
    })




let dictionary = {
    indonesia: { label: "id", data: [] },
    vietnam: { label: "vn", data: [] },
    english: { label: "en", data: [] }
}



function detectAndAssign(rootValue, label, value) {
    let labelName = label.toLowerCase()

    if (dictionary.hasOwnProperty(labelName)) {
        dictionary[labelName].data.push({
            id: rootValue,
            message: value || ""
        })
    }
}

function writeToJson(dicts) {
    Object.entries(dicts).forEach(
        ([key, value]) => {
            let translations = JSON.stringify(dicts[key]["data"])
            fs.writeFileSync(OUTPUT_DIR + dicts[key]["label"] + ".json", translations)
        })

}

function parseSpreadSheet(spreadsheetData) {
    spreadsheetData.map((t) => {
        Object.entries(t).forEach(
            ([key, value]) => {
                if (key != ROOT_FIELD) {
                    detectAndAssign(t[ROOT_FIELD], key, value)
                }
            }
        );
    });
}


extractSheets(
    {
        spreadsheetKey: CONFIGURATION["spreadsheet-key"],
        // credentials
        credentials: require(CREDENTIAL_KEY),
        sheetsToExtract: [CONFIGURATION["sheet-name"]],
    },
    (err, data) => {
        if (err) {
            spinner.stop();
            console.log("ERROR:", err);
        }

        parseSpreadSheet(data[CONFIGURATION["sheet-name"]]);
        writeToJson(dictionary);
        spinner.stop()
        spinner.succeed("translation has been exported")
        spinner.stop()
    }
);


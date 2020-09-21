#!/usr/bin/env node

const fs = require('fs')
const https = require('https')
const path = require('path')
const ora = require('ora')

const DEFAULT_CONFIG_FILE_NAME = 'translasheetrc.json'
const DEFAULT_OUTPUT_DIR = 'src/i18n/'
const FORMAT = 'tsv' // Format you'd like to parse. `tsv` or `csv`

const PROJECT_DIRECTORY = process.cwd()

module.exports = (args) => {
  const spinner = ora('translation spreadsheet to json').start()

  const CONFIG = require(path.join(
    PROJECT_DIRECTORY,
    args.config || DEFAULT_CONFIG_FILE_NAME,
  ))
  const outputTypeArgument = String(args['output-type'] || '')
  let OUTPUT_TYPE = ''

  switch (outputTypeArgument) {
    case 'single':
    case 'multiple':
      OUTPUT_TYPE = args['output-type']
      break
    case '':
      OUTPUT_TYPE = 'single'
      break
    default:
      throw 'output type not found'
      break
  }

  function isFileJSON(filename) {
    let targetOutput = filename.split('.').splice(-1)[0]
    if (targetOutput != 'json' || targetOutput == '') {
      throw 'output file must be json'
    }
    return filename
  }

  function setOutput(outputArgument) {
    if (OUTPUT_TYPE == 'single') {
      let output = outputArgument.split('/').slice(-1)[0]
      isFileJSON(output)
      return outputArgument
    } else {
      return outputArgument
    }
  }

  const OUTPUT = path.join(
    PROJECT_DIRECTORY,
    setOutput(args.output || DEFAULT_OUTPUT_DIR),
  )

  // Error message for required directory
  const ERROR_MESSAGE_CONFIGURATION = {
    googleSheetId: 'spreadsheet id is required for source',
    googlePageSheetId: 'sheet id is required for list translation',
  }

  // Check configuration
  Object.entries(ERROR_MESSAGE_CONFIGURATION).forEach(([key, value]) => {
    if (!CONFIG.hasOwnProperty(key)) {
      spinner.stop()
      throw ERROR_MESSAGE_CONFIGURATION[key]
    }
  })

  const LIST_COUNTRY = {
    indonesia: 'id',
    vietnam: 'vn',
    turkish: 'tr',
    english: 'en',
    thailand: 'th',
  }

  const { country, googleSheetId, googlePageSheetId } = CONFIG

  const GOOGLE_SHEET_ID = googleSheetId // The Google Sheet ID found in the URL of your Google Sheet.
  const PAGE_SHEET_ID = googlePageSheetId // The Page ID of the Sheet you'd like to export. Found as `gid` in the URL.
  const SHEET_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=${FORMAT}&id=${GOOGLE_SHEET_ID}&gid=${PAGE_SHEET_ID}`

  function ab2str(buf) {
    const encodedString = String.fromCharCode.apply(null, buf)
    return decodeURIComponent(encodedString)
  }

  function getTranslationBasedOnCountry(translations, country) {
    let items = [{}]
    Object.entries(translations).forEach(([key, value]) => {
      if (translations[key]['key'] == country) {
        items = translations[key]['data']
      }
    })

    return JSON.stringify(items, null, 2)
  }

  function writeToJson(translations) {
    // Output type single
    if (OUTPUT_TYPE == 'single') {
      fs.writeFileSync(
        OUTPUT,
        getTranslationBasedOnCountry(translations, country),
      )

      // Output type multiple
    } else {
      Object.entries(translations).forEach(([key, value]) => {
        fs.writeFileSync(
          OUTPUT + translations[key]['key'] + '.json',
          JSON.stringify(translations[key]['data'], null, 2),
        )
      })
    }
  }

  const fetchData = (url) => {
    https.get(url, (response) => {
      let body = ''

      if (
        parseInt(response.statusCode / 100, 10) === 3 &&
        response.headers &&
        response.headers.location
      ) {
        return fetchData(response.headers.location)
      }

      response
        .on('data', (data) => {
          body += ab2str(data)
        })
        .on('end', () => {
          function assignCountryKey(num, key, translationJSON) {
            return (translationJSON[num] = { key, data: [] })
          }

          function splitRowText(text) {
            return text.split(/\t/i)
          }

          function getHeaderKey(rows) {
            return splitRowText(rows.splice(0, 1)[0])
              .filter((text) => String(text) && String(text) != 'id')
              .map((text) => String(text).toLowerCase())
              .filter((text) => LIST_COUNTRY.hasOwnProperty(text))
          }

          function assignTranslationKey(translations, rows) {
            getHeaderKey(rows).map((curr, i) =>
              assignCountryKey(i, LIST_COUNTRY[curr], translations),
            )
            return {
              translations,
              rows,
            }
          }

          function splitBodyData(body) {
            return body.split(/\r\n/i)
          }

          function assignDataBasedOnKey(row, translations) {
            let bodyField = row.split(/\t/i)
            let bodyKey = bodyField.splice(0, 1)[0]

            if (String(bodyKey).length == 0) return

            bodyField.map((field, i) => {
              if (translations.hasOwnProperty(i)) {
                translations[i].data.push({
                  id: bodyKey,
                  message: decodeURIComponent(escape(field)),
                })
              }
            })

            return translations
          }

          function assignDataBasedOnCountry(data) {
            return data.rows.reduce((all, row, i) => {
              assignDataBasedOnKey(row, data.translations)
              return all
            }, data.translations)
          }

          // assignTranslationKey(getHeaderKey(rows), translationJSON)

          spinner.stop()
          writeToJson(
            assignDataBasedOnCountry(
              assignTranslationKey({}, splitBodyData(body)),
            ),
          )

          // console.log(translationJSON)
          console.log('JSON translations have been created')
        })
    })
  }

  fetchData(SHEET_URL)
}

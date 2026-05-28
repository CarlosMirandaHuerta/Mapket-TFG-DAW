const controlCharacters = /[\u0000-\u001f\u007f]/g
const riskyTextCharacters = /[<>`{}]/g

export const cleanTextInput = (value, maxLength = 120) => {
  const cleanValue = String(value ?? '')
    .replace(controlCharacters, ' ')
    .replace(riskyTextCharacters, '')
    .replace(/\s+/g, ' ')
    .trim()

  return cleanValue.slice(0, maxLength)
}

export const cleanEmailInput = (value) => {
  return cleanTextInput(value, 254).toLowerCase()
}

export const cleanSearchInput = (value) => {
  return cleanTextInput(value, 80)
}

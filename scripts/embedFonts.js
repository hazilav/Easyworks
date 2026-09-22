const fs = require('fs');
const path = require('path');

const regPath = path.join(__dirname, '..', 'public', 'fonts', 'Montserrat-Regular.ttf');
const boldPath = path.join(__dirname, '..', 'public', 'fonts', 'Montserrat-Bold.ttf');

const regBase64 = fs.readFileSync(regPath).toString('base64');
const boldBase64 = fs.readFileSync(boldPath).toString('base64');

const content = `// Auto-generated embedded Montserrat font base64 for jsPDF
export const MONTSERRAT_REGULAR_BASE64 = '${regBase64}';
export const MONTSERRAT_BOLD_BASE64 = '${boldBase64}';
`;

const outPath = path.join(__dirname, '..', 'src', 'lib', 'montserratFont.ts');
fs.writeFileSync(outPath, content, 'utf8');
console.log('Successfully generated src/lib/montserratFont.ts with size:', content.length);

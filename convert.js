const fs = require('fs');

const csvPath = 'Vendor POC Details_PAN INDIA Instamart - FINAL_LIST.csv';
const jsonPath = 'vendor_data.json';

const csv = fs.readFileSync(csvPath, 'utf8');
const lines = csv.split('\n').filter(l => l.trim() !== '');

function parseCSVRow(str) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < str.length; i++) {
        const char = str.charAt(i);
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

const vendorList = lines.map(parseCSVRow);

let data = { vendor_list: [], tickets: [] };
if (fs.existsSync(jsonPath)) {
    try {
        data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch(e) {}
}

data.vendor_list = vendorList;

fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
console.log('Successfully updated vendor_data.json with ' + vendorList.length + ' rows.');

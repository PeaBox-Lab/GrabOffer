const fs = require('fs');
const data = JSON.parse(fs.readFileSync('amazon/data/amazon-products.json', 'utf8'));
console.log('Categories:', data.categories.length);
const totalProducts = data.categories.reduce((s, c) => s + (c.products || []).length, 0);
console.log('Products total:', totalProducts);
console.log('First cat slug:', data.categories[0].slug);
console.log('First cat products count:', data.categories[0].products.length);
console.log('Sample product id:', data.categories[0].products[0].id);
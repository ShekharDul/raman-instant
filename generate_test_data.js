const fs = require('fs');

function generateCSV() {
  const points = 400;
  let csv = 'Wavenumber,Intensity\n';
  
  for (let i = 0; i < points; i++) {
    const x = 900 + (200 * i) / (points - 1);
    const center = 1000;
    const fwhm = 20;
    const a = 100 * 20; // amplitude parameter
    
    // voigt (eta=0.5)
    const gamma = fwhm / 2;
    const L = (a) / (1 + Math.pow((x - center) / gamma, 2));
    
    const sigma = fwhm / 2.35482;
    const G = a * Math.exp(-Math.pow(x - center, 2) / (2 * Math.pow(sigma, 2)));
    
    let y = 0.5 * L + 0.5 * G;
    
    // Add 2% noise
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    y += z0 * 2.0;
    
    csv += `${x.toFixed(2)},${Math.max(0, y).toFixed(2)}\n`;
  }
  
  fs.writeFileSync('test_data.csv', csv);
  console.log("test_data.csv generated.");
}

generateCSV();

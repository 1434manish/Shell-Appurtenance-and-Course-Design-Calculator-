NozzleThickness revised source files

This package contains the three updated application files:
- index.html
- styles.css
- app.js

Implementation summary:
1. Tab 1 remains Nozzle Thickness.
2. Tab 2 is now Manhole Neck, CP, and BF. General tank details and manhole neck assessment are moved here.
3. Tab 3 is now Shell Design. General details can be copied from Tab 2 and edited independently in Tab 3.
4. The attached Excel workbook's formulas and allowable stresses are used for IS 803, API 650, Bulletin 09/M&I circular retiring thickness, API 653, and corroded-plate values.
5. Design and nominal thickness columns are added for IS 803 and API 650.

To update the existing GitHub Pages project, replace only these three files in the repository. Keep existing data/, icons/, manifest.webmanifest, service worker and other supporting files unchanged.

Important: After publishing, perform a hard refresh in the browser. If the installed PWA still shows the old version, close it fully and reopen it after the hosted page has updated.

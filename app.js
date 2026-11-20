(() => {
  const $ = id => document.getElementById(id);

  // -------------------- Tab navigation --------------------
  const nozzleTab = $('nozzle-tab');
  const manholeTab = $('manhole-tab');
  const shellTab = $('shell-tab');
  const nozzlePanel = $('nozzle-panel');
  const manholePanel = $('manhole-panel');
  const shellPanel = $('shell-panel');

  function activateTab(which) {
    const active = { nozzle: which === 'nozzle', manhole: which === 'manhole', shell: which === 'shell' };
    [[nozzleTab, nozzlePanel, active.nozzle], [manholeTab, manholePanel, active.manhole], [shellTab, shellPanel, active.shell]].forEach(([tab, panel, isActive]) => {
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
      panel.hidden = !isActive;
    });
  }
  nozzleTab.addEventListener('click', () => activateTab('nozzle'));
  manholeTab.addEventListener('click', () => activateTab('manhole'));
  shellTab.addEventListener('click', () => activateTab('shell'));

  // -------------------- Nozzle thickness calculator --------------------
  const diameterInput = $('diameter');
  const averageInput = $('average');
  const scheduleOutput = $('schedule');
  const thicknessOutput = $('thickness');
  const nextScheduleOutput = $('next-schedule');
  const nextThicknessOutput = $('next-thickness');
  const message = $('message');
  const dataStatus = $('data-status');
  const retiringOutput = $('retiring-thickness');
  const retiringStatus = $('retiring-status');
  let entries = [];

  const retiringTable = { 80: 4.80, 100: 5.27, 150: 6.22, 200: 7.16, 250: 8.11 };

  function getRetiringThickness(size) {
    if (retiringTable[size] !== undefined) return retiringTable[size];
    if (size >= 300) return 8.34;
    return null;
  }

  function parseCsv(text) {
    const cleanText = text.replace(/^\uFEFF/, '').trim();
    const lines = cleanText.split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const sizeIndex = headers.indexOf('size_mm');
    const scheduleIndex = headers.indexOf('schedule');
    const thicknessIndex = headers.indexOf('thickness_mm');
    if (sizeIndex < 0 || scheduleIndex < 0 || thicknessIndex < 0) {
      throw new Error('CSV headers do not match the expected format.');
    }
    return lines.slice(1).map(line => {
      const parts = line.split(',');
      const size = Number(parts[sizeIndex]?.trim());
      const schedule = parts[scheduleIndex]?.trim();
      const thickness = Number(parts[thicknessIndex]?.trim());
      if (!Number.isFinite(size) || !Number.isFinite(thickness) || !schedule) return null;
      return { size, schedule, thickness };
    }).filter(Boolean);
  }

  function showEmpty(text) {
    scheduleOutput.textContent = '—';
    thicknessOutput.textContent = '—';
    nextScheduleOutput.textContent = '—';
    nextThicknessOutput.textContent = '—';
    message.textContent = text;
  }

  function updateRetiringAssessment() {
    const sizeText = diameterInput.value.trim();
    const averageText = averageInput.value.trim();
    retiringStatus.className = 'retiring-status';
    if (!sizeText) {
      retiringOutput.textContent = '—';
      retiringStatus.textContent = 'Enter nozzle diameter and average thickness.';
      return;
    }
    const size = Number(sizeText);
    if (!(size > 0)) {
      retiringOutput.textContent = '—';
      retiringStatus.textContent = 'Please enter a valid nozzle diameter.';
      return;
    }
    const retiringThickness = getRetiringThickness(size);
    if (retiringThickness === null) {
      retiringOutput.textContent = '—';
      retiringStatus.textContent = 'Retiring thickness not defined for this diameter.';
      return;
    }
    retiringOutput.textContent = `${retiringThickness.toFixed(2)} mm`;
    if (!averageText) {
      retiringStatus.textContent = 'Enter average thickness to assess nozzle condition.';
      return;
    }
    const average = Number(averageText);
    if (!(average > 0)) {
      retiringStatus.textContent = 'Please enter a valid average thickness.';
      return;
    }
    if (average >= retiringThickness) {
      retiringStatus.textContent = 'Nozzle thickness satisfactory';
      retiringStatus.classList.add('satisfactory');
    } else {
      retiringStatus.textContent = 'Nozzle replacement required !!!';
      retiringStatus.classList.add('replacement');
    }
  }

  function calculate() {
    const sizeText = diameterInput.value.trim();
    const avgText = averageInput.value.trim();
    updateRetiringAssessment();
    if (!sizeText || !avgText) {
      showEmpty('Enter diameter and average thickness.');
      return;
    }
    const size = Number(sizeText);
    const average = Number(avgText);
    if (!(size > 0) || !(average > 0)) {
      showEmpty('Please enter positive numbers for both values.');
      return;
    }
    if (!entries.length) {
      showEmpty('Schedule data is not available.');
      return;
    }
    const matches = entries
      .filter(row => Math.abs(row.size - size) < 0.0001)
      .sort((a, b) => a.thickness - b.thickness);
    if (!matches.length) {
      showEmpty('No matching nozzle diameter found in the schedule data.');
      return;
    }

    let closestIndex = 0;
    for (let i = 1; i < matches.length; i++) {
      if (Math.abs(matches[i].thickness - average) <
          Math.abs(matches[closestIndex].thickness - average)) closestIndex = i;
    }
    const closest = matches[closestIndex];
    scheduleOutput.textContent = closest.schedule;
    thicknessOutput.textContent = `${closest.thickness.toFixed(2)} mm`;

    const exactIndex = matches.findIndex(row => Math.abs(row.thickness - average) < 1e-9);
    if (exactIndex >= 0) {
      nextScheduleOutput.textContent = 'NA (Exact match)';
      nextThicknessOutput.textContent = 'NA (Exact match)';
    } else if (average < matches[0].thickness || average > matches[matches.length - 1].thickness) {
      nextScheduleOutput.textContent = 'NA (Extreme value)';
      nextThicknessOutput.textContent = 'NA (Extreme value)';
    } else {
      const otherIndex = closestIndex === 0 ? 1 :
        closestIndex === matches.length - 1 ? matches.length - 2 :
        (average < closest.thickness ? closestIndex - 1 : closestIndex + 1);
      const next = matches[otherIndex];
      nextScheduleOutput.textContent = next.schedule;
      nextThicknessOutput.textContent = `${next.thickness.toFixed(2)} mm`;
    }
    message.textContent = `Closest standard thickness for ${size} mm diameter.`;
  }

  $('reset').addEventListener('click', () => {
    diameterInput.value = '';
    averageInput.value = '';
    showEmpty('Enter diameter and average thickness.');
    updateRetiringAssessment();
    diameterInput.focus();
  });
  diameterInput.addEventListener('input', calculate);
  averageInput.addEventListener('input', calculate);

  async function loadData() {
    try {
      const response = await fetch('./data/schedule_data.csv');
      if (!response.ok) throw new Error(`CSV request failed (${response.status})`);
      entries = parseCsv(await response.text());
      if (!entries.length) throw new Error('No valid schedule rows were found.');
      dataStatus.textContent = `Offline calculator • ${entries.length} schedule entries`;
      calculate();
    } catch (error) {
      console.error('Schedule data loading error:', error);
      dataStatus.textContent = 'Schedule data could not be loaded';
      showEmpty(error.message);
      updateRetiringAssessment();
    }
  }

  // -------------------- Manhole Neck, CP and BF calculations --------------------
  // Reference tables are retained from the previously validated application.
  // Each row: [tank height, CP-500, CP-600, CP-750, CP-900, BF-500, BF-600, BF-750, BF-900]
  const manholeTables = {
    is803: [
      [8,10,12,12,14,6,8,10,12],
      [10,10,12,14,16,6,8,10,12],
      [12,12,12,16,18,8,10,12,14],
      [14,12,14,16,20,10,12,12,16],
      [16.5,12,14,18,20,10,12,14,18],
      [20,14,16,20,22,12,12,16,20]
    ],
    api650_old: [
      [6.4,8,10,11,13,6,6,8,10],
      [8.2,10,11,13,14,6,8,10,11],
      [9.8,10,11,14,16,6,8,11,13],
      [12,11,13,16,18,8,10,13,14],
      [14,13,14,16,19,10,11,13,16],
      [16,13,14,18,21,10,11,14,18],
      [20,14,16,19,22,11,13,16,19],
      [23,16,18,21,24,12.5,14,18,21]
    ],
    api650_new: [
      [5,8,10,12,13,6,7,9,10],
      [6.5,10,11,13,15,7,8,10,12],
      [8,11,12,14,17,8,9,11,14],
      [9.5,12,13,16,18,9,10,13,15],
      [11,12,14,17,20,9,11,14,17],
      [13,13,15,18,21,10,12,15,18],
      [16,15,17,20,23,12,14,17,20],
      [19,16,18,22,26,13,15,19,23],
      [23,18,20,24,28,15,17,21,25]
    ],
    old_manual: [
      [6.5,10,6], [8,12,8], [10,12,8], [12,12,10],
      [14,14,12], [16.5,14,12], [20,16,12]
    ]
  };

  const diaSelect = $('manhole-dia');
  const codeSelect = $('construction-code');
  const heightInput = $('tank-height');
  const cpInput = $('cp-entered');
  const bfInput = $('bf-entered');
  const neckInput = $('neck-entered');
  const generalIds = ['mh-diameter','tank-height','mh-radiography','mh-joint-efficiency','mh-corrosion-allowance','mh-specific-gravity'];

  function syncGeneralToShell(sourceId) {
    const mapping = {
      'mh-diameter':'shell-diameter',
      'tank-height':'shell-tank-height',
      'mh-corrosion-allowance':'shell-corrosion-allowance',
      'mh-specific-gravity':'shell-specific-gravity'
    };
    if (sourceId === 'mh-radiography') {
      $('shell-radiography').value = $('mh-radiography').value;
      $('shell-joint-efficiency').value = $('mh-joint-efficiency').value;
    } else if (mapping[sourceId]) {
      $(mapping[sourceId]).value = $(sourceId).value;
    } else {
      return;
    }
    window.dispatchEvent(new Event('mh-general-sync'));
  }

  function mhNum(id) {
    const v = $(id).value.trim();
    return v === '' ? NaN : Number(v);
  }
  function mhFmt(v) { return Number.isFinite(v) ? `${v.toFixed(2)} mm` : '—'; }

  function setAssessment(statusEl, enteredEl, requiredEl, entered, required, label, heightExceeded = false) {
    statusEl.className = 'assessment-status';
    enteredEl.textContent = entered === null ? '—' : `${entered.toFixed(2)} mm`;
    requiredEl.textContent = required === null ? (heightExceeded ? 'NA – Height exceeds table limit' : '—') : `${required} mm`;
    if (required === null) {
      statusEl.textContent = heightExceeded ? 'NA – Height exceeds table limit' : 'Enter the required details to assess.';
      return;
    }
    if (entered === null) {
      statusEl.textContent = `Enter ${label} thickness to assess.`;
      return;
    }
    if (entered >= required) {
      statusEl.textContent = `${label} thickness satisfactory`;
      statusEl.classList.add('satisfactory');
    } else {
      statusEl.textContent = `${label} replacement required`;
      statusEl.classList.add('replacement');
    }
  }

  function firstCourseDesign(code, D, H, E, CA, G) {
    if (![D,H,E,CA,G].every(Number.isFinite) || D<=0 || H<=0.3 || E<=0 || G<=0 || CA<0) return NaN;
    if (code === 'is803' || code === 'old_manual') {
      // Excel IS 803/B&R formula: t = 4.9*D*(H-0.3)/(165*E) + CA; G=1 as per IOC norms.
      return Math.max(5, 4.9*D*(H-0.3)/(165*E) + CA);
    }
    // Excel API 650 formula: greater of product-design and hydrostatic-test thickness.
    const td = 4.9*D*(H-0.3)*G/164 + CA;
    const tt = 4.9*D*(H-0.3)/176;
    return Math.max(5, td, tt);
  }

  function firstCourseRetiring(code, D, H, E, G) {
    if (![D,H,E,G].every(Number.isFinite) || D<=0 || H<=0.3 || E<=0 || G<=0) return NaN;
    if (code === 'is803' || code === 'old_manual') {
      // Workbook Circular M&I/19: 4.9*D*(H-0.3)*water SG/(176*E).
      return 4.9*D*(H-0.3)/(176*E);
    }
    // Workbook API 653 allowable stress for lower two courses = 175.89 MPa.
    return 4.9*D*G*(H-0.3)/(175.89*E);
  }

  function calculateNeck(selectedRow) {
    const D=mhNum('mh-diameter'), H=mhNum('tank-height'), E=mhNum('mh-joint-efficiency');
    const CA=mhNum('mh-corrosion-allowance'), G=mhNum('mh-specific-gravity');
    const dia=Number(diaSelect.value), code=codeSelect.value;
    const enteredText=neckInput.value.trim(), entered=enteredText===''?null:Number(enteredText);
    const first=firstCourseDesign(code,D,H,E,CA,G);
    const neckFirst=$('neck-first-course'), neckBF=$('neck-bf-design');
    const neckRequired=$('neck-required'), neckEntered=$('neck-entered-result');
    const status=$('neck-status'), note=$('neck-note');
    neckEntered.textContent=entered===null?'—':mhFmt(entered);
    neckFirst.textContent=Number.isFinite(first)?mhFmt(first):'—';
    neckBF.textContent=selectedRow?mhFmt(code==='old_manual'?selectedRow[2]:selectedRow[5+({500:0,600:1,750:2,900:3}[dia])]):'—';
    neckRequired.textContent='—';
    status.className='shell-neck-status';
    note.textContent='';
    if (!code || !Number.isFinite(D) || !Number.isFinite(H) || !Number.isFinite(E) || !Number.isFinite(CA) || !Number.isFinite(G) || !dia) {
      status.textContent='Complete general details and select the manhole neck diameter and construction code.';
      return;
    }
    if (!selectedRow) {
      neckBF.textContent='NA – Height exceeds table limit';
      status.textContent='NA – Tank height exceeds the selected standard table limit.';
      note.textContent='No bolting-flange thickness is available above the highest height in the selected reference table. No extrapolation has been applied.';
      return;
    }
    const bf=code==='old_manual'?selectedRow[2]:selectedRow[5+({500:0,600:1,750:2,900:3}[dia])];
    if (!Number.isFinite(first)) {
      status.textContent='Enter valid tank diameter, height, radiography, corrosion allowance and product specific gravity.';
      return;
    }
    const required=Math.min(first,bf);
    neckRequired.textContent=mhFmt(required);
    if (entered===null || !Number.isFinite(entered) || entered<0) {
      status.textContent='Enter the measured manhole neck thickness to complete the assessment.';
      return;
    }
    if (entered>=required) {
      status.textContent='Neck thickness satisfactory';
      status.classList.add('satisfactory');
      return;
    }
    // Retiring-thickness exception is applicable only when first-course design governs.
    if (first < bf) {
      const retiring=firstCourseRetiring(code,D,H,E,G);
      if (Number.isFinite(retiring) && entered>=retiring) {
        status.textContent=`Manhole Neck thickness not satisfactory as per 1st course design thickness / BF design but satisfactory as per 1st course retiring thickness (${retiring.toFixed(2)} mm).`;
        status.classList.add('retiring-exception');
        note.textContent='';
        return;
      }
    }
    status.textContent='Neck replacement required';
    status.classList.add('replacement');
  }

  function calculateManhole() {
    const dia=Number(diaSelect.value), code=codeSelect.value, height=mhNum('tank-height');
    const cpText=cpInput.value.trim(), bfText=bfInput.value.trim();
    const cpEntered=cpText===''?null:Number(cpText), bfEntered=bfText===''?null:Number(bfText);
    const cpEnteredEl=$('cp-result-entered'), cpRequiredEl=$('cp-required'), cpStatusEl=$('cp-status');
    const bfEnteredEl=$('bf-result-entered'), bfRequiredEl=$('bf-required'), bfStatusEl=$('bf-status');
    const heightOutput=$('applicable-height'), note=$('manhole-message');
    const rows=manholeTables[code] || [];
    const selected=(Number.isFinite(height) && height>0)?rows.find(row=>row[0]>=height):null;
    if (!diaSelect.value || !code || !Number.isFinite(height) || height<=0) {
      heightOutput.textContent='—';
      setAssessment(cpStatusEl,cpEnteredEl,cpRequiredEl,cpEntered,null,'CP');
      setAssessment(bfStatusEl,bfEnteredEl,bfRequiredEl,bfEntered,null,'BF');
      calculateNeck(null);
      note.textContent='Select the manhole diameter and construction code, and enter a valid tank height.';
      return;
    }
    if (!selected) {
      heightOutput.textContent='NA – Height exceeds table limit';
      setAssessment(cpStatusEl,cpEnteredEl,cpRequiredEl,cpEntered,null,'CP',true);
      setAssessment(bfStatusEl,bfEnteredEl,bfRequiredEl,bfEntered,null,'BF',true);
      calculateNeck(null);
      note.textContent='Tank height exceeds the highest height listed in the selected standard table. No extrapolation has been applied.';
      return;
    }
    let cpRequired,bfRequired;
    if (code==='old_manual') {
      cpRequired=selected[1]; bfRequired=selected[2];
    } else {
      const idx={500:0,600:1,750:2,900:3}[dia];
      cpRequired=selected[1+idx]; bfRequired=selected[5+idx];
    }
    heightOutput.textContent=`${selected[0].toFixed(1)} m`;
    setAssessment(cpStatusEl,cpEnteredEl,cpRequiredEl,cpEntered,cpRequired,'CP');
    setAssessment(bfStatusEl,bfEnteredEl,bfRequiredEl,bfEntered,bfRequired,'BF');
    calculateNeck(selected);
    note.textContent=`Minimum thicknesses selected from the ${selected[0].toFixed(1)} m row.`;
  }

  $('mh-radiography').addEventListener('change',()=>{
    const e=$('mh-radiography').value;
    $('mh-joint-efficiency').value=e?Number(e).toFixed(2):'';
    calculateManhole();
    syncGeneralToShell('mh-radiography');
  });
  ['mh-diameter','tank-height','mh-corrosion-allowance','mh-specific-gravity'].forEach(id=>{
    $(id).addEventListener('input',()=>{ calculateManhole(); syncGeneralToShell(id); });
    $(id).addEventListener('change',()=>{ calculateManhole(); syncGeneralToShell(id); });
  });
  [diaSelect,codeSelect,heightInput,cpInput,bfInput,neckInput].forEach(el=>{
    el.addEventListener('input',calculateManhole);
    el.addEventListener('change',calculateManhole);
  });
  $('manhole-reset').addEventListener('click',()=>{
    generalIds.forEach(id=>$(id).value='');
    $('mh-corrosion-allowance').value='1.5';
    diaSelect.value=''; codeSelect.value='';
    cpInput.value=''; bfInput.value=''; neckInput.value='';
    calculateManhole();
    ['mh-diameter','tank-height','mh-radiography','mh-corrosion-allowance','mh-specific-gravity'].forEach(syncGeneralToShell);
  });
  calculateManhole();

  loadData();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('Offline support could not be enabled:', err);
      });
    });
  }
})();


// -------------------- Shell Design calculator --------------------
(() => {
  const $s = id => document.getElementById(`shell-${id}`);
  const MAX_COURSES = 18;
  const DEFAULT_HEIGHTS = Array(MAX_COURSES).fill(1.5);
  let activeResult = 'design';
  let lastShellResults = [];

  function ordinal(n) {
    const suffix = ['th','st','nd','rd'], v = n % 100;
    return n + (suffix[(v-20)%10] || suffix[v] || suffix[0]);
  }
  function val(id) {
    const raw=$s(id).value.trim();
    return raw===''?NaN:Number(raw);
  }
  function fmt(v) { return Number.isFinite(v) ? v.toFixed(2) : '—'; }

  for (let n=1; n<=MAX_COURSES; n++) $s('course-count').add(new Option(String(n), String(n)));
  $s('course-count').value='8';

  function nominalThickness(design, diameter) {
    let minimum;
    if (diameter < 15) minimum=5;
    else if (diameter < 36) minimum=6;
    else if (diameter < 60) minimum=8;
    else minimum=10;
    if (minimum===5 && design<=5) return 5;
    const target=Math.max(design,minimum);
    return Math.ceil((target-1e-10)/2)*2;
  }

  function makeCourseRows() {
    const count=Number($s('course-count').value);
    const old=[...document.querySelectorAll('.shell-course-height')].map(el=>el.value);
    $s('course-rows').innerHTML='';
    for(let i=0;i<count;i++) {
      const tr=document.createElement('tr'),td1=document.createElement('td'),td2=document.createElement('td');
      const label=document.createElement('label');
      label.textContent=`${ordinal(i+1)} Shell Course`; label.htmlFor=`shell-course-${i}`;
      const input=document.createElement('input');
      input.type='number'; input.min='0'; input.step='0.01'; input.id=`shell-course-${i}`;
      input.className='shell-course-height'; input.value=old[i] ?? DEFAULT_HEIGHTS[i] ?? 1.5;
      input.setAttribute('aria-label',`${ordinal(i+1)} shell course height in metres`);
      input.addEventListener('input',calculateShell);
      td1.appendChild(label); td2.appendChild(input); tr.append(td1,td2); $s('course-rows').appendChild(tr);
    }
    $s('course-summary').textContent=`${count} course${count===1?'':'s'} configured`;
    calculateShell();
  }

  function calculateShell() {
    const D=val('diameter'), H=val('tank-height'), CA=val('corrosion-allowance');
    const G=val('specific-gravity'), radioValue=$s('radiography').value, E=radioValue===''?NaN:Number(radioValue);
    $s('joint-efficiency').value=Number.isFinite(E)?E.toFixed(2):'';
    const heights=[...document.querySelectorAll('.shell-course-height')].map(el=>Number(el.value));
    const sum=heights.reduce((a,b)=>a+(Number.isFinite(b)?b:0),0), diff=sum-H;
    if (Number.isFinite(H) && Math.abs(diff)>0.01) {
      $s('height-check').textContent=`Note: Sum of entered course heights is ${fmt(sum)} m, while tank height is ${fmt(H)} m (difference ${fmt(diff)} m). Check the input values.`;
      $s('height-check').className='shell-height-check warning';
    } else if(Number.isFinite(H)) {
      $s('height-check').textContent=`Total course height: ${fmt(sum)} m — matches tank height.`;
      $s('height-check').className='shell-height-check match';
    } else {
      $s('height-check').textContent='Enter valid tank height and shell-course heights.';
      $s('height-check').className='shell-height-check warning';
    }
    const valid=D>0 && H>0.3 && G>0 && Number.isFinite(E) && E>0 && CA>=0 &&
      heights.length>0 && heights.every(h=>Number.isFinite(h)&&h>0);
    if(!valid) {
      lastShellResults=[];
      $s('result-panel').innerHTML='<p class="shell-muted">Enter valid tank diameter, tank height, radiography, corrosion allowance, product specific gravity and each shell-course height.</p>';
      return;
    }

    // Allowable stresses and equations taken from the attached workbook.
    const api650Sd=164;
    const api650St=176;
    const is803Allowable=165;
    const bulletinStress=176;
    const api653Lower=175.89;
    const api653Other=193.52;
    let liquidHead=H;
    const results=heights.map((courseHeight,i)=>{
      const head=liquidHead;
      // IS 803/B&R: workbook uses water SG = 1 for this formula.
      const is803Raw=4.9*D*(head-0.3)/(is803Allowable*E)+CA;
      const is803=Math.max(is803Raw,5);
      // API 650: greater of product design thickness and hydrostatic test thickness.
      const td=4.9*D*(head-0.3)*G/api650Sd+CA;
      const tt=4.9*D*(head-0.3)/api650St;
      const api650=Math.max(td,tt,5);
      const is803Nominal=nominalThickness(is803,D);
      const api650Nominal=nominalThickness(api650,D);
      // Entire-shell retiring thickness: Bulletin 09 / Circular M&I/19 basis and API 653.
      const bulletin=4.9*D*(head-0.3)/(bulletinStress*E);
      const api653Stress=i<2?api653Lower:api653Other;
      const api653=4.9*D*G*(head-0.3)/(api653Stress*E);
      // Local corroded-plate formulae use the workbook's lower-two-course API 653 stress.
      const away=4.9*D*head*G/api653Lower;
      const near=4.9*D*head*G/(api653Lower*E);
      const row={course:ordinal(i+1),height:courseHeight,head,is803,is803Nominal,api650,api650Nominal,bulletin,api653,away,near};
      liquidHead-=courseHeight;
      return row;
    });
    lastShellResults=results;
    renderShellResults(results);
  }

  function renderShellResults(rows) {
    const configs={
      design:{title:'Design Thickness (mm)',grouped:true,cols:[['is803','Design'],['is803Nominal','Nominal'],['api650','Design'],['api650Nominal','Nominal']]},
      entire:{title:'Retiring Thickness – Entire Shell (mm)',cols:[['bulletin','As per Bulletin 09 dated 30.05.1994'],['api653','As per API 653']]},
      corroded:{title:'Retiring Thickness – Specific Area of a Corroded Plate as per API 653 (mm)',cols:[['away','Away from weld'],['near','Near weld']]}
    };
    const config=configs[activeResult],table=document.createElement('table'); table.className='shell-result-table';
    if(activeResult==='design') table.classList.add('design-result-table');
    const thead=document.createElement('thead');
    if(config.grouped) {
      const groupRow=document.createElement('tr');
      ['Shell course','Course height (m)'].forEach((label)=>{
        const th=document.createElement('th'); th.textContent=label; th.rowSpan=2; th.className='shell-rowspan-head'; groupRow.appendChild(th);
      });
      [['As per IS 803',2],['As per API 650',2]].forEach(([label,span])=>{
        const th=document.createElement('th'); th.textContent=label; th.colSpan=span; th.className='shell-group-head'; groupRow.appendChild(th);
      });
      thead.appendChild(groupRow);
      const detailRow=document.createElement('tr');
      config.cols.forEach((col)=>{const th=document.createElement('th');th.textContent=col[1];detailRow.appendChild(th);});
      thead.appendChild(detailRow);
    } else {
      const hr=document.createElement('tr');
      ['Shell course','Course height (m)',...config.cols.map(c=>c[1])].forEach(t=>{const th=document.createElement('th');th.textContent=t;hr.appendChild(th);});
      thead.appendChild(hr);
    }
    table.appendChild(thead);
    const tbody=document.createElement('tbody');
    rows.forEach(row=>{
      const tr=document.createElement('tr');
      [row.course,fmt(row.height),...config.cols.map(([key])=>fmt(row[key]))].forEach((v,i)=>{
        const td=document.createElement('td');
        if(i>=2){const pill=document.createElement('span');pill.className='shell-value-pill';pill.textContent=v;td.appendChild(pill);}
        else td.textContent=v;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    const panel=$s('result-panel');panel.innerHTML='';
    const title=document.createElement('h3');title.className='shell-result-title';title.textContent=config.title;
    const wrap=document.createElement('div');wrap.className='shell-course-table-wrap';wrap.appendChild(table);
    panel.append(title,wrap);
  }

  document.querySelectorAll('.shell-result-tab').forEach(tab=>tab.addEventListener('click',()=>{
    activeResult=tab.dataset.shellResult;
    document.querySelectorAll('.shell-result-tab').forEach(t=>{
      const active=t===tab;t.classList.toggle('active',active);t.setAttribute('aria-selected',String(active));
    });
    if(lastShellResults.length)renderShellResults(lastShellResults);
  }));
  ['diameter','tank-height','corrosion-allowance','specific-gravity','radiography'].forEach(id=>{
    $s(id).addEventListener('input',calculateShell);
    $s(id).addEventListener('change',calculateShell);
  });
  $('fill-all-heights').addEventListener('click',()=>{
    const fields=[...document.querySelectorAll('.shell-course-height')];
    if(!fields.length) return;
    const firstValue=fields[0].value.trim();
    if(!firstValue) return;
    fields.forEach(field=>{field.value=firstValue;});
    calculateShell();
  });
  $s('course-count').addEventListener('change',makeCourseRows);
  window.addEventListener('mh-general-sync',calculateShell);
  $('shell-reset').addEventListener('click',()=>{
    $s('diameter').value='';$s('tank-height').value='';$s('radiography').value='';
    $s('joint-efficiency').value='';$s('corrosion-allowance').value='1.5';$s('specific-gravity').value='';
    $s('course-count').value='8';makeCourseRows();
  });
  makeCourseRows();
})();

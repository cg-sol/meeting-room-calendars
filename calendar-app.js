

let currentMode = 'single';
let singleCalendar = null;
let multiCalendars = {};
let currentDate = new Date();

// Event cache to reduce fetches
const eventCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Multiple CORS proxies for fallback
const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest='
];

function init() {
    console.log('Initializing calendar viewer...');
    populateCalendarSelect();
    populateCheckboxGrid();
    updateCurrentDateDisplay();
}

function populateCalendarSelect() {
    const select = document.getElementById('calendar-select');
    CALENDARS.forEach((cal, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = cal.name;
        select.appendChild(option);
    });
    console.log('Populated', CALENDARS.length, 'calendars in dropdown');
}

function populateCheckboxGrid() {
    const grid = document.getElementById('checkbox-grid');
    CALENDARS.forEach((cal, index) => {
        const div = document.createElement('div');
        div.className = 'checkbox-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `cal-${index}`;
        checkbox.value = index;
        
        const label = document.createElement('label');
        label.htmlFor = `cal-${index}`;
        label.textContent = cal.name;
        label.style.cursor = 'pointer';
        
        div.appendChild(checkbox);
        div.appendChild(label);
        grid.appendChild(div);
    });
}

function switchMode(mode) {
    currentMode = mode;
    
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    if (mode === 'single') {
        document.getElementById('single-select-area').style.display = 'flex';
        document.getElementById('view-select-area').style.display = 'flex';
        document.getElementById('multi-select-area').classList.remove('active');
        document.getElementById('single-calendar').style.display = 'block';
        document.getElementById('multi-calendar-grid').classList.remove('active');
        
        const viewSelect = document.getElementById('view-type');
        viewSelect.innerHTML = `
            <option value="dayGridMonth">Month</option>
            <option value="timeGridWeek">Week</option>
            <option value="timeGridDay">Day</option>
        `;
    } else {
        document.getElementById('single-select-area').style.display = 'none';
        document.getElementById('view-select-area').style.display = 'flex';
        document.getElementById('multi-select-area').classList.add('active');
        document.getElementById('single-calendar').style.display = 'none';
        document.getElementById('multi-calendar-grid').classList.add('active');
        
        const viewSelect = document.getElementById('view-type');
        viewSelect.innerHTML = `
            <option value="timeGridWeek">Week</option>
            <option value="timeGridDay">Day</option>
        `;
        viewSelect.value = 'timeGridWeek';
    }
}

async function loadSingleCalendar() {
    const selectIndex = document.getElementById('calendar-select').value;
    if (!selectIndex) return;
    
    const calendar = CALENDARS[selectIndex];
    console.log('Loading calendar:', calendar.name, 'URL:', calendar.url);
    showLoading(true);
    hideError();
    
    try {
        const events = await fetchCalendarEvents(calendar.url, calendar.color, calendar.name);
        console.log('Loaded', events.length, 'events for', calendar.name);
        
        if (singleCalendar) {
            singleCalendar.destroy();
        }
        
        const calendarEl = document.getElementById('single-calendar');
        const viewType = document.getElementById('view-type').value;
        
        singleCalendar = new FullCalendar.Calendar(calendarEl, {
            initialView: viewType,
            initialDate: currentDate,
            headerToolbar: false,
            height: 'auto',
            events: events,
            eventClick: function(info) {
                alert('Event: ' + info.event.title + '\n' +
                      'Start: ' + info.event.start.toLocaleString() + '\n' +
                      'End: ' + (info.event.end ? info.event.end.toLocaleString() : 'N/A'));
            },
            datesSet: function(dateInfo) {
                currentDate = dateInfo.view.currentStart;
                updateCurrentDateDisplay();
            }
        });
        
        singleCalendar.render();
        showLoading(false);
    } catch (error) {
        console.error('ERROR loading calendar:', error);
        showError('Failed to load calendar: ' + error.message);
        showLoading(false);
    }
}

async function loadMultipleCalendars() {
    const selectedIndices = Array.from(document.querySelectorAll('#checkbox-grid input:checked'))
        .map(cb => parseInt(cb.value));
    
    if (selectedIndices.length === 0) {
        alert('Please select at least one calendar');
        return;
    }
    
    if (selectedIndices.length > 4) {
        alert('For best viewing, please select 4 or fewer calendars. You selected ' + selectedIndices.length);
    }
    
    console.log('Loading', selectedIndices.length, 'calendars');
    showLoading(true);
    hideError();
    
    const gridEl = document.getElementById('multi-calendar-grid');
    gridEl.innerHTML = '';
    multiCalendars = {};
    
    try {
        const viewType = document.getElementById('view-type').value;
        
        for (const index of selectedIndices) {
            const calendar = CALENDARS[index];
            console.log('Loading', calendar.name);
            const events = await fetchCalendarEvents(calendar.url, calendar.color, calendar.name);
            
            const wrapper = document.createElement('div');
            wrapper.className = 'calendar-wrapper';
            
            const title = document.createElement('h3');
            title.textContent = calendar.name;
            wrapper.appendChild(title);
            
            const calDiv = document.createElement('div');
            calDiv.id = `multi-cal-${index}`;
            wrapper.appendChild(calDiv);
            
            gridEl.appendChild(wrapper);
            
            const cal = new FullCalendar.Calendar(calDiv, {
                initialView: viewType,
                initialDate: currentDate,
                headerToolbar: false,
                height: 'auto',
                events: events,
                eventClick: function(info) {
                    alert('Event: ' + info.event.title + '\n' +
                          'Room: ' + calendar.name + '\n' +
                          'Start: ' + info.event.start.toLocaleString() + '\n' +
                          'End: ' + (info.event.end ? info.event.end.toLocaleString() : 'N/A'));
                }
            });
            
            cal.render();
            multiCalendars[index] = cal;
        }
        
        showLoading(false);
        updateCurrentDateDisplay();
    } catch (error) {
        console.error('ERROR loading calendars:', error);
        showError('Failed to load calendars: ' + error.message);
        showLoading(false);
    }
}

async function fetchCalendarEvents(url, color, calendarName) {
    // Check cache first
    const cacheKey = url;
    const cached = eventCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
        console.log('Using cached events for', calendarName);
        return cached.events;
    }
    
    // Try each CORS proxy in sequence
    for (let proxyIndex = 0; proxyIndex < CORS_PROXIES.length; proxyIndex++) {
        const proxy = CORS_PROXIES[proxyIndex];
        const proxyUrl = proxy + encodeURIComponent(url);
        
        console.log(`Attempt ${proxyIndex + 1}/${CORS_PROXIES.length}: Fetching ${calendarName} via ${proxy.substring(0, 30)}...`);
        
        try {
            const events = await fetchWithRetry(proxyUrl, 2, 10000); // 2 retries, 10s timeout
            const parsedEvents = parseICS(events, color);
            
            // Cache successful result
            eventCache.set(cacheKey, {
                events: parsedEvents,
                timestamp: Date.now()
            });
            
            console.log(`✅ Success with proxy ${proxyIndex + 1}: ${parsedEvents.length} events`);
            return parsedEvents;
            
        } catch (error) {
            console.warn(`Proxy ${proxyIndex + 1} failed for ${calendarName}:`, error.message);
            
            // If this was the last proxy, throw error
            if (proxyIndex === CORS_PROXIES.length - 1) {
                throw new Error(`Failed after trying ${CORS_PROXIES.length} proxies: ${error.message}`);
            }
            // Otherwise, continue to next proxy
        }
    }
}

async function fetchWithRetry(url, maxRetries, timeout) {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(url, { 
                signal: controller.signal,
                cache: 'no-cache'
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const icsData = await response.text();
            
            if (!icsData || icsData.trim().length === 0) {
                throw new Error('Empty response from server');
            }
            
            console.log('Received', icsData.length, 'characters of data');
            return icsData;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn(`Attempt ${attempt} timed out after ${timeout}ms`);
            } else {
                console.warn(`Attempt ${attempt} failed:`, error.message);
            }
            
            if (attempt <= maxRetries) {
                const delay = attempt * 1000; // Progressive delay: 1s, 2s, 3s
                console.log(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
}

function parseICS(icsData, color) {
    const events = [];
    
    try {
        // Validate ICS format
        if (!icsData.includes('BEGIN:VCALENDAR')) {
            console.error('NOT ICS FORMAT!');
            console.error('Data received:', icsData.substring(0, 500));
            throw new Error('Invalid ICS format - not a calendar file');
        }
        
        console.log('Parsing ICS data...');
        const jcalData = ICAL.parse(icsData);
        const comp = new ICAL.Component(jcalData);
        const vevents = comp.getAllSubcomponents('vevent');
        
        console.log('Found', vevents.length, 'events in calendar');
        
        vevents.forEach((vevent, idx) => {
            try {
                const event = new ICAL.Event(vevent);
                
                const fcEvent = {
                    title: event.summary || 'Untitled Event',
                    start: event.startDate.toJSDate(),
                    end: event.endDate.toJSDate(),
                    backgroundColor: color,
                    borderColor: color,
                    description: event.description || '',
                    location: event.location || ''
                };
                
                // Handle recurring events
                if (event.isRecurring()) {
                    try {
                        const expand = event.iterator();
                        let next;
                        let count = 0;
                        const maxOccurrences = 100;
                        
                        while ((next = expand.next()) && count < maxOccurrences) {
                            const occurrence = event.getOccurrenceDetails(next);
                            events.push({
                                ...fcEvent,
                                start: occurrence.startDate.toJSDate(),
                                end: occurrence.endDate.toJSDate()
                            });
                            count++;
                        }
                        console.log('Expanded recurring event into', count, 'occurrences');
                    } catch (recurError) {
                        console.warn('Error expanding recurring event:', recurError);
                        events.push(fcEvent);
                    }
                } else {
                    events.push(fcEvent);
                }
            } catch (eventError) {
                console.warn('Error parsing event', idx, ':', eventError);
            }
        });
        
        console.log('Successfully parsed', events.length, 'total events');
        
    } catch (error) {
        console.error('PARSE ERROR:', error);
        console.error('Failed ICS data (first 500 chars):', icsData.substring(0, 500));
        throw new Error('Failed to parse calendar data - ' + error.message);
    }
    
    return events;
}

function navigatePrev() {
    if (currentMode === 'single' && singleCalendar) {
        singleCalendar.prev();
    } else if (currentMode === 'multi') {
        Object.values(multiCalendars).forEach(cal => cal.prev());
        updateCurrentDateDisplay();
    }
}

function navigateNext() {
    if (currentMode === 'single' && singleCalendar) {
        singleCalendar.next();
    } else if (currentMode === 'multi') {
        Object.values(multiCalendars).forEach(cal => cal.next());
        updateCurrentDateDisplay();
    }
}

function navigateToday() {
    currentDate = new Date();
    if (currentMode === 'single' && singleCalendar) {
        singleCalendar.today();
    } else if (currentMode === 'multi') {
        Object.values(multiCalendars).forEach(cal => cal.today());
        updateCurrentDateDisplay();
    }
}

function changeView() {
    const viewType = document.getElementById('view-type').value;
    
    if (currentMode === 'single' && singleCalendar) {
        singleCalendar.changeView(viewType);
    } else if (currentMode === 'multi') {
        Object.values(multiCalendars).forEach(cal => cal.changeView(viewType));
    }
}

function updateCurrentDateDisplay() {
    const displayEl = document.getElementById('current-date');
    const viewType = document.getElementById('view-type').value;
    
    let dateStr = '';
    if (viewType === 'dayGridMonth') {
        dateStr = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (viewType === 'timeGridWeek') {
        const start = new Date(currentDate);
        const end = new Date(currentDate);
        end.setDate(end.getDate() + 6);
        dateStr = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (viewType === 'timeGridDay') {
        dateStr = currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    
    displayEl.textContent = dateStr;
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function showError(message) {
    const errorEl = document.getElementById('error');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

function hideError() {
    document.getElementById('error').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', init);

console.log('calendar-app.js loaded successfully (ENHANCED VERSION with fallback proxies)');

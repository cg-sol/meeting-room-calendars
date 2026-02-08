// Main application logic for meeting room calendar viewer

let currentMode = 'single';
let singleCalendar = null;
let multiCalendars = {};
let currentDate = new Date();

// Initialize the application
function init() {
    populateCalendarSelect();
    populateCheckboxGrid();
    updateCurrentDateDisplay();
}

// Populate the dropdown for single calendar selection
function populateCalendarSelect() {
    const select = document.getElementById('calendar-select');
    CALENDARS.forEach((cal, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = cal.name;
        select.appendChild(option);
    });
}

// Populate checkboxes for multi-calendar selection
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

// Switch between single and multi-calendar modes
function switchMode(mode) {
    currentMode = mode;
    
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Show/hide appropriate controls
    if (mode === 'single') {
        document.getElementById('single-select-area').style.display = 'flex';
        document.getElementById('view-select-area').style.display = 'flex';
        document.getElementById('multi-select-area').classList.remove('active');
        document.getElementById('single-calendar').style.display = 'block';
        document.getElementById('multi-calendar-grid').classList.remove('active');
        
        // Reset multi-calendar view
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
        
        // Remove month view option for multi-calendar
        const viewSelect = document.getElementById('view-type');
        viewSelect.innerHTML = `
            <option value="timeGridWeek">Week</option>
            <option value="timeGridDay">Day</option>
        `;
        viewSelect.value = 'timeGridWeek';
    }
}

// Load single calendar
async function loadSingleCalendar() {
    const selectIndex = document.getElementById('calendar-select').value;
    if (!selectIndex) return;
    
    const calendar = CALENDARS[selectIndex];
    showLoading(true);
    hideError();
    
    try {
        const events = await fetchCalendarEvents(calendar.url, calendar.color);
        
        // Destroy existing calendar if it exists
        if (singleCalendar) {
            singleCalendar.destroy();
        }
        
        // Create new calendar
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
        showError('Failed to load calendar: ' + error.message);
        showLoading(false);
    }
}

// Load multiple calendars side by side
async function loadMultipleCalendars() {
    const selectedIndices = Array.from(document.querySelectorAll('#checkbox-grid input:checked'))
        .map(cb => parseInt(cb.value));
    
    if (selectedIndices.length === 0) {
        alert('Please select at least one calendar');
        return;
    }
    
    showLoading(true);
    hideError();
    
    // Clear existing calendars
    const gridEl = document.getElementById('multi-calendar-grid');
    gridEl.innerHTML = '';
    multiCalendars = {};
    
    try {
        const viewType = document.getElementById('view-type').value;
        
        for (const index of selectedIndices) {
            const calendar = CALENDARS[index];
            const events = await fetchCalendarEvents(calendar.url, calendar.color);
            
            // Create wrapper div
            const wrapper = document.createElement('div');
            wrapper.className = 'calendar-wrapper';
            
            const title = document.createElement('h3');
            title.textContent = calendar.name;
            wrapper.appendChild(title);
            
            const calDiv = document.createElement('div');
            calDiv.id = `multi-cal-${index}`;
            wrapper.appendChild(calDiv);
            
            gridEl.appendChild(wrapper);
            
            // Create calendar instance
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
        showError('Failed to load calendars: ' + error.message);
        showLoading(false);
    }
}

// Fetch and parse calendar events from ICS URL
async function fetchCalendarEvents(url, color) {
    try {
        // Use CORS proxy for fetching ICS files
        const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
            throw new Error('Failed to fetch calendar data');
        }
        
        const icsData = await response.text();
        return parseICS(icsData, color);
    } catch (error) {
        console.error('Error fetching calendar:', error);
        throw error;
    }
}

// Parse ICS data into FullCalendar events
function parseICS(icsData, color) {
    const events = [];
    
    try {
        const jcalData = ICAL.parse(icsData);
        const comp = new ICAL.Component(jcalData);
        const vevents = comp.getAllSubcomponents('vevent');
        
        vevents.forEach(vevent => {
            const event = new ICAL.Event(vevent);
            
            const fcEvent = {
                title: event.summary,
                start: event.startDate.toJSDate(),
                end: event.endDate.toJSDate(),
                backgroundColor: color,
                borderColor: color,
                description: event.description || '',
                location: event.location || ''
            };
            
            // Handle recurring events
            if (event.isRecurring()) {
                const expand = event.iterator();
                let next;
                let count = 0;
                const maxOccurrences = 100; // Limit recurring events
                
                while ((next = expand.next()) && count < maxOccurrences) {
                    const occurrence = event.getOccurrenceDetails(next);
                    events.push({
                        ...fcEvent,
                        start: occurrence.startDate.toJSDate(),
                        end: occurrence.endDate.toJSDate()
                    });
                    count++;
                }
            } else {
                events.push(fcEvent);
            }
        });
    } catch (error) {
        console.error('Error parsing ICS data:', error);
        throw new Error('Failed to parse calendar data');
    }
    
    return events;
}

// Navigation functions
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

// Change calendar view type
function changeView() {
    const viewType = document.getElementById('view-type').value;
    
    if (currentMode === 'single' && singleCalendar) {
        singleCalendar.changeView(viewType);
    } else if (currentMode === 'multi') {
        Object.values(multiCalendars).forEach(cal => cal.changeView(viewType));
    }
}

// Update current date display
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

// UI helper functions
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

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);

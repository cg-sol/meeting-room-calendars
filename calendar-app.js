// Main application logic for meeting room calendar viewer - UPDATED VERSION

let currentMode = 'single';
let singleCalendar = null;
let multiCalendars = {};
let currentDate = new Date();
let eventCache = {}; // Cache events to avoid refetching

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
        const events = await fetchCalendarEvents(calendar.url, calendar.color, selectIndex);
        
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
            slotMinTime: '06:00:00',  // Show calendar from 6 AM
            slotMaxTime: '22:00:00',  // Show calendar until 10 PM
            allDaySlot: true,
            nowIndicator: true,
            scrollTime: '08:00:00',   // Scroll to 8 AM by default
            eventClick: function(info) {
                alert('Event: ' + info.event.title + '\n' +
                      'Start: ' + info.event.start.toLocaleString() + '\n' +
                      'End: ' + (info.event.end ? info.event.end.toLocaleString() : 'N/A'));
            },
            datesSet: function(dateInfo) {
                currentDate = dateInfo.view.currentStart;
                updateCurrentDateDisplay();
            },
            eventDidMount: function(info) {
                // Ensure events are visible in day view
                if (info.view.type === 'timeGridDay') {
                    info.el.style.opacity = '1';
                }
            }
        });
        
        singleCalendar.render();
        
        // Force a resize after render to fix display issues
        setTimeout(() => {
            if (singleCalendar) {
                singleCalendar.updateSize();
            }
        }, 100);
        
        showLoading(false);
    } catch (error) {
        showError('Failed to load calendar: ' + error.message + ' - Please try again');
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
    
    if (selectedIndices.length > 4) {
        if (!confirm('You selected ' + selectedIndices.length + ' calendars. For best viewing, we recommend 4 or fewer. Continue anyway?')) {
            return;
        }
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
            const events = await fetchCalendarEvents(calendar.url, calendar.color, index);
            
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
                slotMinTime: '06:00:00',
                slotMaxTime: '22:00:00',
                allDaySlot: true,
                nowIndicator: true,
                scrollTime: '08:00:00',
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
        
        // Force resize after all calendars are rendered
        setTimeout(() => {
            Object.values(multiCalendars).forEach(cal => {
                cal.updateSize();
            });
        }, 200);
        
        showLoading(false);
        updateCurrentDateDisplay();
    } catch (error) {
        showError('Failed to load calendars: ' + error.message + ' - Please try again');
        showLoading(false);
    }
}

// Fetch and parse calendar events from ICS URL with retry logic
async function fetchCalendarEvents(url, color, cacheKey) {
    // Check cache first
    if (eventCache[cacheKey]) {
        console.log('Using cached events for calendar ' + cacheKey);
        return eventCache[cacheKey];
    }
    
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Fetching calendar ${cacheKey}, attempt ${attempt}/${maxRetries}`);
            
            // Use CORS proxy for fetching ICS files
            const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
            const response = await fetch(proxyUrl, {
                signal: AbortSignal.timeout(15000) // 15 second timeout
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const icsData = await response.text();
            
            if (!icsData || icsData.trim().length === 0) {
                throw new Error('Empty calendar data received');
            }
            
            const events = parseICS(icsData, color);
            
            // Cache the events
            eventCache[cacheKey] = events;
            
            return events;
        } catch (error) {
            lastError = error;
            console.error(`Attempt ${attempt} failed:`, error);
            
            if (attempt < maxRetries) {
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }
    
    throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
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
                location: event.location || '',
                allDay: event.startDate.isDate // Properly handle all-day events
            };
            
            // Handle recurring events
            if (event.isRecurring()) {
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
            } else {
                events.push(fcEvent);
            }
        });
    } catch (error) {
        console.error('Error parsing ICS data:', error);
        throw new Error('Failed to parse calendar data - Invalid ICS format');
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
        // Force resize after view change
        setTimeout(() => {
            if (singleCalendar) {
                singleCalendar.updateSize();
            }
        }, 100);
    } else if (currentMode === 'multi') {
        Object.values(multiCalendars).forEach(cal => {
            cal.changeView(viewType);
        });
        // Force resize after view change
        setTimeout(() => {
            Object.values(multiCalendars).forEach(cal => {
                cal.updateSize();
            });
        }, 100);
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

// Clear event cache (useful if calendars are updated)
function clearCache() {
    eventCache = {};
    console.log('Event cache cleared');
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);

// Handle window resize to update calendar sizes
let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        if (singleCalendar) {
            singleCalendar.updateSize();
        }
        Object.values(multiCalendars).forEach(cal => {
            cal.updateSize();
        });
    }, 250);
});

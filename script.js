const API_KEY = '05bf661f10a144f0a0c54cad2c5df623';
const API_URL = 'https://api-v3.mbta.com';

const stations = {
    'place-sstat': 'South Station',
    'place-north': 'North Station',
    'place-bbsta': 'Back Bay',
    'place-forhl': 'Forest Hills',
    'place-DB-0095' : 'Readville',
    'place-brntn': 'Braintree',
    'place-qnctr': 'Quincy Center'
};

document.addEventListener('DOMContentLoaded', () => {
    createStationSelector();
    updateBoard(Object.keys(stations)[0]); // Default to South Station
});

function createStationSelector() {
    const selector = document.createElement('select');
    selector.id = 'station-selector';

    for (const [id, name] of Object.entries(stations)) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        selector.appendChild(option);
    }

    selector.addEventListener('change', () => {
        updateBoard(selector.value);
    });

    document.body.insertBefore(selector, document.getElementById('train-board'));
}

async function fetchDepartures(stationId) {
    const now = new Date().toISOString();
    const url = `${API_URL}/schedules?filter[min_time]=${now}&filter[stop]=${stationId}&filter[route_type]=2&sort=departure_time&include=trip,route,prediction,stop&api_key=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    return data;
}

function getPredictionForTrip(tripId, included) {
    return included.find(item => item.type === "prediction" && item.relationships?.trip?.data?.id === tripId);
}

function getTripHeadsign(tripId, included) {
  const trip = included.find(item => item.type === "trip" && item.id === tripId);
  return trip ? trip.attributes.headsign : tripId;
}

function formatTime(isoTime) {
    const date = new Date(isoTime);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12; // No leading zero
    return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function getStatus(prediction) {
    if (!prediction) return "On time";
    const status = prediction.attributes.status;
    return status || "On time";
}

function getTrack(prediction) {
    if (!prediction) return null;
    const stopId = prediction.relationships?.stop?.data?.id;
    const parts = stopId?.split("-");
    const last = parts?.[parts.length - 1];
    return isNaN(last) ? null : String(parseInt(last)); // Removes leading zeros
}

function extractTrainNumber(tripId) {
    if (!tripId) return '—';
    const parts = tripId.split('-');
    const trainNum = parts.find(part => /^\d{2,4}$/.test(part));
    return trainNum || '—';
  }

function renderTrainBoard(departures) {
    const board = document.getElementById('train-board');
    if (!board) {
        console.error('Element #train-board not found');
        return;
    }

    board.innerHTML = '';

    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Time</th>
                <th>Train</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Track</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    const now = new Date();

    departures.forEach(dep => {
        const departureTime = new Date(dep.attributes.departure_time);
        if (departureTime < now) return;

        const tripId = dep.relationships.trip?.data?.id;
        const routeId = dep.relationships.route?.data?.id;
        const prediction = getPredictionForTrip(tripId, dep.included);
        const status = getStatus(prediction);
        const track = getTrack(prediction);
        const destination = getTripHeadsign(tripId, dep.included);
        const time = formatTime(dep.attributes.departure_time);
        const trainNumber = extractTrainNumber(tripId);

        const row = document.createElement('tr');
        row.innerHTML = `
        <td data-label="Time">${time}</td>
        <td data-label="Train">${trainNumber}</td>
        <td data-label="Destination">${destination}</td>
        <td data-label="Status">${status}</td>
        <td data-label="Track">${track || '—'}</td>
    `;
        tbody.appendChild(row);
    });

    board.appendChild(table);
}

async function updateBoard(stationId) {
    try {
        const data = await fetchDepartures(stationId);
        const schedules = data.data;
        const included = data.included || [];

        const enrichedDepartures = schedules.map(dep => ({
            ...dep,
            included
        }));

        renderTrainBoard(enrichedDepartures);
    } catch (error) {
        console.error(`Failed to fetch departures for ${stationId}:`, error);
    }
}

// Refresh current selection every 30 seconds
setInterval(() => {
    const stationId = document.getElementById('station-selector').value;
    updateBoard(stationId);
}, 30000);

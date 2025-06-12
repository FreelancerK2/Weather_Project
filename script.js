$(document).ready(function() {
    const API_KEY = '99093e9e3e9e5de3660a10e9bb1f9ee7';
    let currentCity = '';
    let map;
    let marker;
    
    // Update current time
    function updateCurrentTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        $('#current-time').text(timeString);
    }
    
    // Update time every second
    setInterval(updateCurrentTime, 1000);
    updateCurrentTime(); // Initial call
    
    // Show loading state
    function showLoading(element) {
        $(element).html('<div class="loading"></div>');
    }
    
    // Show error message
    function showError(message) {
        const errorElement = $('#error-message');
        errorElement.text(message).fadeIn();
        setTimeout(() => errorElement.fadeOut(), 5000);
    }
    
    // Tab switching with animation
    $('.tab').click(function() {
        const $this = $(this);
        if ($this.hasClass('active')) return;
        
        $('.tab').removeClass('active');
        $this.addClass('active');
        
        const tabId = $this.data('tab');
        $('.tab-content').removeClass('active');
        $(`#${tabId}`).addClass('active');
    });
    
    // Initialize with user's location or default city
    function initializeWeather() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude: lat, longitude: lon } = position.coords;
                    getWeatherByCoords(lat, lon);
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    getWeatherByCity('London');
                },
                { timeout: 10000 }
            );
        } else {
            getWeatherByCity('London');
        }
    }
    
    // Search functionality with debounce
    let searchTimeout;
    $('#search-btn').click(searchWeather);
    $('#city-input').on('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(searchWeather, 500);
    });
    
    function searchWeather() {
        const city = $('#city-input').val().trim();
        if (city) {
            getWeatherByCity(city);
        }
    }
    
    // Show 404 error page
    function show404Error() {
        $('#weather-content').hide();
        $('#error-404').fadeIn();
    }

    // Hide 404 error page
    function hide404Error() {
        $('#error-404').hide();
        $('#weather-content').fadeIn();
    }

    // Back button handler
    $('#back-to-weather').click(function(e) {
        e.preventDefault();
        hide404Error();
    });
    
    function updateLocationDisplay(city) {
        $('#location-name').text(city);
    }
    
    async function getWeatherByCity(city) {
        try {
            currentCity = city;
            $('#city-input').val(city);
            updateLocationDisplay(city);
            showLoading('#hourly-forecast, #nearby-cities, #five-day-forecast, #day-hourly-forecast');
            
            const weatherData = await $.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`);
            
            if (!weatherData || weatherData.cod === '404') {
                show404Error();
                return;
            }
            
            hide404Error();
            displayCurrentWeather(weatherData);
            await Promise.all([
                getHourlyForecast(weatherData.coord.lat, weatherData.coord.lon),
                getNearbyCities(weatherData.coord.lat, weatherData.coord.lon),
                getFiveDayForecast(weatherData.coord.lat, weatherData.coord.lon)
            ]);
            updateMap(weatherData.coord.lat, weatherData.coord.lon);
        } catch (error) {
            if (error.status === 404) {
                show404Error();
            } else {
                showError('Error fetching weather data. Please try another city.');
            }
            console.error('Error:', error);
        }
    }
    
    async function getWeatherByCoords(lat, lon) {
        try {
            const locationData = await $.get(`https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`);
            
            if (!locationData || locationData.length === 0) {
                show404Error();
                return;
            }

            currentCity = locationData[0].name;
            $('#city-input').val(currentCity);
            updateLocationDisplay(currentCity);
            
            const weatherData = await $.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`);
            
            if (!weatherData || weatherData.cod === '404') {
                show404Error();
                return;
            }
            
            hide404Error();
            displayCurrentWeather(weatherData);
            await Promise.all([
                getHourlyForecast(lat, lon),
                getNearbyCities(lat, lon),
                getFiveDayForecast(lat, lon)
            ]);
            updateMap(lat, lon);
        } catch (error) {
            if (error.status === 404) {
                show404Error();
            } else {
                showError('Error determining location. Using default city.');
                getWeatherByCity('London');
            }
        }
    }
    
    function displayCurrentWeather(data) {
        const date = new Date(data.dt * 1000);
        const sunrise = new Date(data.sys.sunrise * 1000);
        const sunset = new Date(data.sys.sunset * 1000);
        
        // Calculate day length
        const dayLengthMs = sunset - sunrise;
        const hours = Math.floor(dayLengthMs / (1000 * 60 * 60));
        const minutes = Math.floor((dayLengthMs % (1000 * 60 * 60)) / (1000 * 60));
        
        // Update header icon with current weather
        $('h1 span').html(getWeatherIcon(data.weather[0].icon));
        
        $('#current-date').text(date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }));
        $('#current-icon').html(getWeatherIcon(data.weather[0].icon));
        $('#current-desc').text(data.weather[0].description);
        $('#current-temp').text(`${Math.round(data.main.temp)}°C`);
        $('#current-feel').text(`${Math.round(data.main.feels_like)}°C`);
        $('#sunrise').text(sunrise.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        $('#sunset').text(sunset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        $('#day-length').text(`${hours}h ${minutes}m`);
        $('#humidity').text(`${data.main.humidity}%`);
        $('#wind').text(`${data.wind.speed} m/s, ${getWindDirection(data.wind.deg)}`);
        $('#visibility').text(`${(data.visibility / 1000).toFixed(1)} km`);
    }
    
    async function getHourlyForecast(lat, lon) {
        try {
            const data = await $.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`);
            const now = new Date();
            const hourlyContainer = $('#hourly-forecast');
            hourlyContainer.empty();
            
            // Filter for today's hourly forecast
            const todayForecast = data.list.filter(item => {
                const forecastDate = new Date(item.dt * 1000);
                return forecastDate.getDate() === now.getDate();
            });
            
            todayForecast.forEach(item => {
                const time = new Date(item.dt * 1000);
                hourlyContainer.append(`
                    <div class="hourly-item">
                        <div>${time.toLocaleTimeString([], { hour: '2-digit' })}</div>
                        <div class="weather-icon-small">${getWeatherIcon(item.weather[0].icon)}</div>
                        <div>${item.weather[0].description}</div>
                        <div>${Math.round(item.main.temp)}°C</div>
                        <div>Feels ${Math.round(item.main.feels_like)}°C</div>
                        <div>${item.wind.speed} m/s ${getWindDirection(item.wind.deg)}</div>
                    </div>
                `);
            });
        } catch (error) {
            console.error('Error fetching hourly forecast:', error);
            showError('Error loading hourly forecast');
        }
    }
    
    async function getNearbyCities(lat, lon) {
        try {
            const data = await $.get(`https://api.openweathermap.org/data/2.5/find?lat=${lat}&lon=${lon}&cnt=5&appid=${API_KEY}&units=metric`);
            const nearbyContainer = $('#nearby-cities');
            nearbyContainer.empty();
            
            data.list.forEach(city => {
                nearbyContainer.append(`
                    <div class="city-item">
                        <div>${city.name}</div>
                        <div class="weather-icon-small">${getWeatherIcon(city.weather[0].icon)}</div>
                        <div>${Math.round(city.main.temp)}°C</div>
                    </div>
                `);
            });
        } catch (error) {
            console.error('Error fetching nearby cities:', error);
            showError('Error loading nearby cities');
        }
    }
    
    async function getFiveDayForecast(lat, lon) {
        try {
            const data = await $.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`);
            const fiveDayContainer = $('#five-day-forecast');
            fiveDayContainer.empty();
            
            // Group by day
            const dailyForecasts = {};
            data.list.forEach(item => {
                const date = new Date(item.dt * 1000);
                const dateStr = date.toLocaleDateString();
                
                if (!dailyForecasts[dateStr]) {
                    dailyForecasts[dateStr] = {
                        date: date,
                        items: []
                    };
                }
                dailyForecasts[dateStr].items.push(item);
            });
            
            // Get next 5 days
            const forecastDays = Object.values(dailyForecasts).slice(0, 6);
            
            forecastDays.forEach((day, index) => {
                const date = day.date;
                const dayItems = day.items;
                
                // Calculate min/max temp for the day
                let minTemp = Infinity;
                let maxTemp = -Infinity;
                let mainWeather = null;
                
                dayItems.forEach(item => {
                    if (item.main.temp_min < minTemp) minTemp = item.main.temp_min;
                    if (item.main.temp_max > maxTemp) maxTemp = item.main.temp_max;
                    if (!mainWeather) mainWeather = item.weather[0];
                });
                
                const dayElement = $(`
                    <div class="day-item ${index === 0 ? 'selected' : ''}" data-date="${date.toISOString()}">
                        <div>${date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div>${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                        <div class="weather-icon-small">${getWeatherIcon(mainWeather.icon)}</div>
                        <div>${Math.round(minTemp)}°/${Math.round(maxTemp)}°</div>
                        <div>${mainWeather.description}</div>
                    </div>
                `);
                
                dayElement.click(function() {
                    $('.day-item').removeClass('selected');
                    $(this).addClass('selected');
                    displayDayHourlyForecast(dayItems);
                });
                
                fiveDayContainer.append(dayElement);
                
                // Display hourly forecast for today by default
                if (index === 0) {
                    displayDayHourlyForecast(dayItems);
                }
            });
        } catch (error) {
            console.error('Error fetching 5-day forecast:', error);
            showError('Error loading 5-day forecast');
        }
    }
    
    function displayDayHourlyForecast(dayItems) {
        const hourlyContainer = $('#day-hourly-forecast');
        hourlyContainer.empty();
        
        dayItems.forEach(item => {
            const time = new Date(item.dt * 1000);
            hourlyContainer.append(`
                <div class="hourly-item">
                    <div>${time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div class="weather-icon-small">${getWeatherIcon(item.weather[0].icon)}</div>
                    <div>${item.weather[0].description}</div>
                    <div>${Math.round(item.main.temp)}°C</div>
                    <div>Feels ${Math.round(item.main.feels_like)}°C</div>
                    <div>${item.wind.speed} m/s ${getWindDirection(item.wind.deg)}</div>
                </div>
            `);
        });
        
        hourlyContainer.addClass('five-day-forecast');
    }
    
    function getWeatherIcon(iconCode) {
        const iconMap = {
            '01d': '☀️', '01n': '🌙',
            '02d': '⛅', '02n': '⛅',
            '03d': '☁️', '03n': '☁️',
            '04d': '☁️', '04n': '☁️',
            '09d': '🌧️', '09n': '🌧️',
            '10d': '🌦️', '10n': '🌦️',
            '11d': '⛈️', '11n': '⛈️',
            '13d': '❄️', '13n': '❄️',
            '50d': '🌫️', '50n': '🌫️'
        };
        return iconMap[iconCode] || '☀️';
    }
    
    function getWindDirection(degrees) {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round((degrees % 360) / 45);
        return directions[index % 8];
    }

    function initMap(lat, lon) {
        if (map) {
            map.remove();
        }
        
        map = L.map('map', {
            center: [lat, lon],
            zoom: 10,
            zoomControl: true,
            attributionControl: true
        });

        // Add dark theme tile layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);
        
        // Add a marker with custom style
        marker = L.marker([lat, lon], {
            icon: L.divIcon({
                className: 'custom-marker',
                html: '<div style="background-color: var(--primary); width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            })
        }).addTo(map)
            .bindPopup(currentCity)
            .openPopup();
    }

    function updateMap(lat, lon) {
        if (map) {
            map.setView([lat, lon], 10);
            marker.setLatLng([lat, lon])
                .setPopupContent(currentCity)
                .openPopup();
        } else {
            initMap(lat, lon);
        }
    }
    
    // Initialize the weather app
    initializeWeather();
}); 
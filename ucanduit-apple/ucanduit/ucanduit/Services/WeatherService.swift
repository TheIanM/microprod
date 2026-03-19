import Foundation

/// Weather data matching the JS app's WeatherData structure
struct WeatherData {
    let location: String
    let temperature: Double     // Celsius
    let feelsLike: Double
    let condition: String       // Normalized: "clear", "cloudy", "rain", etc.
    let humidity: Int?
    let windSpeed: Int?         // km/h
    let windDirection: String?
    let pressure: Double?       // kPa
    let timestamp: Date
}

/// Fetches weather from Environment Canada's public RSS API.
/// Currently hardcoded to Toronto, matching the JS app.
@Observable
final class WeatherService {
    var currentWeather: WeatherData?
    var isLoading = false
    var errorMessage: String?

    // 30-minute cache TTL — same as JS app
    private var cachedWeather: WeatherData?
    private var cacheTimestamp: Date?
    private let cacheTTL: TimeInterval = 30 * 60

    private let cityCode = "on-143"
    private let locationName = "Toronto, ON"

    func fetchWeather() async {
        // Return cached data if still fresh
        if let cached = cachedWeather,
           let ts = cacheTimestamp,
           Date().timeIntervalSince(ts) < cacheTTL {
            currentWeather = cached
            return
        }

        isLoading = true
        errorMessage = nil

        let urlString = "https://weather.gc.ca/rss/city/\(cityCode)_e.xml"
        guard let url = URL(string: urlString) else {
            errorMessage = "Invalid weather URL"
            isLoading = false
            return
        }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            guard let xml = String(data: data, encoding: .utf8) else {
                throw URLError(.cannotDecodeContentData)
            }

            // Plan had parseWeatherXML returning optional with no nil check — fixed here
            guard let weather = parseWeatherXML(xml) else {
                errorMessage = "Could not parse weather data"
                isLoading = false
                return
            }

            currentWeather = weather
            cachedWeather = weather
            cacheTimestamp = Date()
        } catch {
            errorMessage = "Weather unavailable — have you tried looking out a window?"
            // Serve stale cache if we have it
            if let cached = cachedWeather { currentWeather = cached }
        }

        isLoading = false
    }

    /// Parse Environment Canada RSS XML for current conditions.
    /// Uses the same extraction patterns as the JS app's weather-service.js.
    private func parseWeatherXML(_ xml: String) -> WeatherData? {
        var temperature: Double = 0
        if let range = xml.range(of: "(-?\\d+\\.?\\d*)°C", options: .regularExpression) {
            let match = String(xml[range]).replacingOccurrences(of: "°C", with: "")
            temperature = Double(match) ?? 0
        }

        var condition = "unknown"
        if let range = xml.range(of: "<title>Current Conditions: ([^<]+)</title>",
                                  options: .regularExpression) {
            condition = String(xml[range])
                .replacingOccurrences(of: "<title>Current Conditions: ", with: "")
                .replacingOccurrences(of: "</title>", with: "")
                .lowercased()
        }

        var humidity: Int?
        if let range = xml.range(of: "Humidity:\\s*(\\d+)\\s*%", options: .regularExpression) {
            let match = String(xml[range])
                .replacingOccurrences(of: "Humidity:", with: "")
                .replacingOccurrences(of: "%", with: "")
                .trimmingCharacters(in: .whitespaces)
            humidity = Int(match)
        }

        var windSpeed: Int?
        var windDirection: String?
        if let range = xml.range(of: "Wind:\\s*([A-Z]+)\\s*(\\d+)\\s*km/h",
                                  options: .regularExpression) {
            let parts = String(xml[range])
                .components(separatedBy: .whitespaces)
                .filter { !$0.isEmpty }
            if parts.count >= 3 {
                windDirection = parts[1]
                windSpeed = Int(parts[2])
            }
        }

        return WeatherData(
            location: locationName,
            temperature: temperature,
            feelsLike: temperature, // humidex parsing can be added later
            condition: normalizeCondition(condition),
            humidity: humidity,
            windSpeed: windSpeed,
            windDirection: windDirection,
            pressure: nil,
            timestamp: Date()
        )
    }

    /// Normalize raw condition strings to the same categories the JS app uses
    private func normalizeCondition(_ raw: String) -> String {
        let s = raw.lowercased()
        if s.contains("clear") || s.contains("sunny")                              { return "clear" }
        if s.contains("cloud") || s.contains("overcast")                           { return "cloudy" }
        if s.contains("rain") || s.contains("shower") || s.contains("drizzle")    { return "rain" }
        if s.contains("snow") || s.contains("flurr")                              { return "snow" }
        if s.contains("thunder") || s.contains("storm")                            { return "storm" }
        if s.contains("fog") || s.contains("mist") || s.contains("haze")          { return "fog" }
        if s.contains("partly")                                                    { return "partly cloudy" }
        return s
    }
}

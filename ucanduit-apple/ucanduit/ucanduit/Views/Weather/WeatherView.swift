import SwiftUI

struct WeatherView: View {
    @State private var weatherService = WeatherService()

    var body: some View {
        VStack(spacing: 12) {
            if weatherService.isLoading {
                ProgressView("Loading weather...")
            } else if let weather = weatherService.currentWeather {
                Text(weather.location)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text("\(Int(weather.temperature))°C")
                    .font(.system(size: 42, weight: .light))

                HStack {
                    Image(systemName: conditionIcon(weather.condition))
                        .font(.title2)
                    Text(weather.condition.capitalized)
                }

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    if let humidity = weather.humidity {
                        detailItem("Humidity", value: "\(humidity)%")
                    }
                    if let wind = weather.windSpeed, let dir = weather.windDirection {
                        detailItem("Wind", value: "\(dir) \(wind) km/h")
                    }
                }
                .font(.caption)
            } else if let error = weatherService.errorMessage {
                Text(error).foregroundStyle(.secondary)
            }

            Button("Refresh") {
                Task { await weatherService.fetchWeather() }
            }
            .buttonStyle(.bordered)
        }
        .padding()
        .navigationTitle("Weather")
        .task { await weatherService.fetchWeather() }
    }

    private func detailItem(_ label: String, value: String) -> some View {
        VStack {
            Text(label).foregroundStyle(.secondary)
            Text(value).fontWeight(.medium)
        }
    }

    /// Map normalized condition strings to SF Symbols
    private func conditionIcon(_ condition: String) -> String {
        switch condition {
        case "clear":         return "sun.max.fill"
        case "cloudy":        return "cloud.fill"
        case "partly cloudy": return "cloud.sun.fill"
        case "rain":          return "cloud.rain.fill"
        case "snow":          return "cloud.snow.fill"
        case "storm":         return "cloud.bolt.fill"
        case "fog":           return "cloud.fog.fill"
        default:              return "cloud.fill"
        }
    }
}

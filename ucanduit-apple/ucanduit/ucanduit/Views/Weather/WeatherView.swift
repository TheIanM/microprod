import SwiftUI

struct WeatherView: View {
    @State private var weatherService = WeatherService()

    var body: some View {
        VStack(spacing: 12) {
            if weatherService.isLoading {
                ProgressView("Loading weather...")
                    .font(.quicksand(13))
            } else if let weather = weatherService.currentWeather {
                // Location
                Text(weather.location)
                    .font(.quicksand(13))
                    .foregroundStyle(.secondary)

                // Temperature
                Text("\(Int(weather.temperature))°C")
                    .font(.quicksand(42, weight: .light))

                // Condition icon (animated) + label
                HStack(spacing: 8) {
                    Image(systemName: conditionIcon(weather.condition))
                        .font(.title2)
                        .symbolEffect(.variableColor.iterative.reversing, options: .repeating)
                    Text(weather.condition.capitalized)
                        .font(.quicksand(14))
                }

                // Detail grid: humidity + wind
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    if let humidity = weather.humidity {
                        detailItem("Humidity", value: "\(humidity)%")
                    }
                    if let wind = weather.windSpeed, let dir = weather.windDirection {
                        detailItem("Wind", value: "\(dir) \(wind) km/h")
                    }
                }
                .font(.quicksand(12))

                // Last checked timestamp
                HStack(spacing: 4) {
                    IconoirIcon("refresh", size: 12).foregroundStyle(.tertiary)
                    Text("Updated \(weather.timestamp, style: .relative) ago")
                        .font(.quicksand(11))
                        .foregroundStyle(.tertiary)
                }

            } else if let error = weatherService.errorMessage {
                Text(error)
                    .font(.quicksand(13))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            Button {
                Task { await weatherService.fetchWeather() }
            } label: {
                HStack(spacing: 4) {
                    IconoirIcon("refresh", size: 14)
                    Text("Refresh")
                        .font(.quicksand(14, weight: .medium))
                }
            }
            .buttonStyle(.ucanduit)
        }
        .task { await weatherService.fetchWeather() }
    }

    private func detailItem(_ label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(label).foregroundStyle(.secondary)
            Text(value).font(.quicksand(13, weight: .medium))
        }
    }

    /// Map normalized condition strings to SF Symbols (variable-color animated)
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

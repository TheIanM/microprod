import SwiftUI
import SwiftData

struct SettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var allSettings: [AppSettings]

    /// Returns the singleton settings object, creating one with defaults if none exists yet.
    private var settings: AppSettings {
        if let existing = allSettings.first {
            return existing
        }
        let newSettings = AppSettings()
        modelContext.insert(newSettings)
        return newSettings
    }

    var body: some View {
        Form {
            Section("Timer") {
                Stepper(
                    "Default duration: \(settings.defaultTimerMinutes) min",
                    value: Bindable(settings).defaultTimerMinutes,
                    in: 1...120
                )
                Toggle("Timer sounds", isOn: Bindable(settings).timerSoundEnabled)
            }

            Section("Audio") {
                VolumeSlider(label: "Master", value: Bindable(settings).masterVolume)
                VolumeSlider(label: "Ambient", value: Bindable(settings).ambientVolume)
                VolumeSlider(label: "Music", value: Bindable(settings).musicVolume)
            }

            Section("Appearance") {
                Picker("Theme", selection: Bindable(settings).theme) {
                    Text("Auto").tag("auto")
                    Text("Light").tag("light")
                    Text("Dark").tag("dark")
                }
                Toggle("Always on top", isOn: Bindable(settings).alwaysOnTop)
                Toggle("Notifications", isOn: Bindable(settings).showNotifications)
            }

            Section("General") {
                Toggle("Usage analytics", isOn: Bindable(settings).analyticsEnabled)
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Settings")
    }
}

/// Reusable volume slider — displays 0.0–1.0 as 0–100%
struct VolumeSlider: View {
    let label: String
    @Binding var value: Float

    var body: some View {
        HStack {
            Text(label)
            Slider(value: $value, in: 0...1)
            Text("\(Int(value * 100))%")
                .monospacedDigit()
                .frame(width: 40, alignment: .trailing)
        }
    }
}

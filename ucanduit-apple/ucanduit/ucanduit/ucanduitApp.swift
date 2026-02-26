import SwiftUI
import SwiftData
import CoreText

@main
struct UcanduitApp: App {
    init() {
        registerFonts()
    }

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            TodoItem.self,
            TodoList.self,
            Memo.self,
            TimerSession.self,
            AppSettings.self,
            AnalyticsEntry.self,
        ])
        let modelConfiguration = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: false
        )
        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(sharedModelContainer)
    }

    /// Registers Quicksand variable font so Font.custom("Quicksand", size:) works throughout the app.
    /// The variable font covers all weights — no need to register individual static weights.
    private func registerFonts() {
        guard let url = Bundle.main.url(
            forResource: "Quicksand-VariableFont_wght",
            withExtension: "ttf",
            subdirectory: "Quicksand"
        ) else {
            print("⚠️ Quicksand font not found in bundle")
            return
        }
        CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
    }
}

import Foundation
import UserNotifications

/// Wraps UNUserNotificationCenter for timer-completion system notifications.
///
/// Design decisions:
/// - Singleton so the delegate registration happens once and persists.
/// - Authorization is requested lazily — on first timer *start*, not at app launch.
///   This avoids a permission prompt before the user has any context.
/// - Acts as its own UNUserNotificationCenterDelegate to suppress the system banner
///   when the app is in the foreground (the in-app confetti celebration handles it instead).
final class NotificationService: NSObject, UNUserNotificationCenterDelegate {

    static let shared = NotificationService()

    private let center = UNUserNotificationCenter.current()

    private override init() {
        super.init()
        center.delegate = self
    }

    // MARK: - Authorization

    /// Request notification permission. Safe to call repeatedly — the system only
    /// shows the alert dialog once; subsequent calls resolve silently.
    func requestAuthorization() {
        center.requestAuthorization(options: [.alert, .sound, .badge]) { _, error in
            if let error {
                print("⚠️ Notification auth error: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Timer Notification

    /// Fire an immediate system notification announcing timer completion.
    /// - Parameter sessionType: The session type that just finished (used in the body copy).
    func scheduleTimerCompletion(sessionType: SessionType) {
        let content = UNMutableNotificationContent()
        content.title = "Timer Complete"
        content.body = completionBody(for: sessionType)
        content.sound = .default

        // UNTimeIntervalNotificationTrigger requires timeInterval > 0
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.1, repeats: false)
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: trigger
        )

        center.add(request) { error in
            if let error {
                print("⚠️ Notification scheduling error: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - UNUserNotificationCenterDelegate

    /// Called when a notification is about to be presented while the app is in the foreground.
    /// We suppress the system banner here because the app's own celebration UI (confetti,
    /// ring hold) already communicates completion to the user.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Pass empty options → no banner, no sound when foreground
        completionHandler([])
    }

    // MARK: - Helpers

    private func completionBody(for type: SessionType) -> String {
        switch type {
        case .pomodoro:   return "Great work! Time for a short break."
        case .quick:      return "Quick session done. Keep the momentum!"
        case .focus:      return "Deep focus session complete. Well done."
        case .shortBreak: return "Break over — ready to focus again?"
        case .longBreak:  return "Long break finished. Refreshed and ready?"
        case .custom:     return "Timer finished!"
        }
    }
}

import SwiftUI

private struct IsEmbeddedKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    /// True when this view is rendered inside a CollapsibleSection.
    /// Views with internal List/ScrollView should call .scrollDisabled(isEmbedded).
    var isEmbedded: Bool {
        get { self[IsEmbeddedKey.self] }
        set { self[IsEmbeddedKey.self] = newValue }
    }
}

import SwiftUI

/// PreferenceKey that propagates a single CGFloat scroll offset up the view tree.
/// Placed on the inner VStack of the macOS ScrollView so ContentView can read
/// the current scroll position and drive AnimatedBackgroundView blur.
struct ScrollOffsetKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

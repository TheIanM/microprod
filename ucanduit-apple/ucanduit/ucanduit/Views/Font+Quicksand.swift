import SwiftUI

extension Font {
    /// Quicksand at a given size and weight.
    /// Falls back to system font gracefully if registration failed.
    static func quicksand(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        Font.custom("Quicksand", size: size).weight(weight)
    }
}

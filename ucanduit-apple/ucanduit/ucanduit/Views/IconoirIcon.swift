import SwiftUI
#if os(macOS)
import AppKit
#endif

/// Renders an Iconoir SVG icon from the app bundle.
///
/// SVGs are bundled in the icons/regular/ directory. Xcode's resource copy
/// flattens them into Contents/Resources/, so we load by filename alone.
/// isTemplate = true makes them tintable via .foregroundStyle().
///
/// Usage:
///   IconoirIcon("timer")                        // 20pt, inherits foreground color
///   IconoirIcon("play", size: 16)
///   IconoirIcon("trash").foregroundStyle(.red)
struct IconoirIcon: View {
    let name: String
    var size: CGFloat = 20

    var body: some View {
        #if os(macOS)
        if let image = loadSVG() {
            Image(nsImage: image)
                .resizable()
                .scaledToFit()
                .frame(width: size, height: size)
        } else {
            // Visible fallback so missing icons don't silently break layout
            Image(systemName: "questionmark.circle")
                .frame(width: size, height: size)
        }
        #else
        // iOS: SVG bundle loading requires asset catalog — SF Symbol fallback for now
        // TODO: add iOS SVG support when targeting iOS
        Image(systemName: "circle")
            .frame(width: size, height: size)
        #endif
    }

    #if os(macOS)
    private func loadSVG() -> NSImage? {
        // Files land flat in Resources/ after Xcode copies them from icons/regular/
        guard let url = Bundle.main.url(forResource: name, withExtension: "svg") else {
            return nil
        }
        let image = NSImage(contentsOf: url)
        image?.isTemplate = true  // enables .foregroundStyle() tinting
        return image
    }
    #endif
}

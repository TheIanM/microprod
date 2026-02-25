import SwiftUI

/// Animated background matching the original uduit Swift implementation.
/// Six blurred circles (one per brand color) randomly positioned and slowly pulsing.
/// Uses drawingGroup() to render all circles into a single Metal texture for performance.
struct AnimatedBackgroundView: View {
    @Environment(\.colorScheme) private var colorScheme

    @State private var circles: [CircleConfig] = []
    @State private var pulsing = false

    // Four size options matching the original Swift implementation
    private let sizes: [CGFloat] = [200, 300, 400, 500]

    // Six brand colors from styles.css :root, one per circle
    private let colors: [Color] = [
        Color(red: 0.306, green: 0.812, blue: 0.616),  // #4ecf9d  udu-green
        Color(red: 0.247, green: 0.533, blue: 0.773),  // #3f88c5  candu-blue
        Color(red: 0.843, green: 0.149, blue: 0.220),  // #d72638  woohoo-red
        Color(red: 1.000, green: 0.420, blue: 0.624),  // #FF6B9F  perfect-pink
        Color(red: 1.000, green: 0.608, blue: 0.329),  // #FF9B54  oh-orange
        Color(red: 0.690, green: 0.420, blue: 1.000),  // #B06BFF  please-purple
    ]

    var body: some View {
        GeometryReader { geo in
            ZStack {
                // Base color: --not-white in light mode, dark --not-white in dark mode
                baseColor

                ForEach(circles) { circle in
                    Circle()
                        .fill(circle.color)
                        .frame(width: circle.size, height: circle.size)
                        .scaleEffect(pulsing ? 2.0 : 1.0)  // 1x → 2x, same as original
                        .blur(radius: pulsing ? 80 : 40)   // blur 40 → 80 during pulse
                        .opacity(0.3)
                        .position(
                            x: geo.size.width  * circle.xFrac,
                            y: geo.size.height * circle.yFrac
                        )
                        .animation(
                            .easeInOut(duration: 20)        // 20s matches original
                            .repeatForever(autoreverses: true)
                            .delay(circle.delay),
                            value: pulsing
                        )
                }
            }
            // Render all circles into a single Metal texture — original uses this too
            .drawingGroup()
        }
        .onAppear {
            generateCircles()
            pulsing = true
        }
    }

    // MARK: - Helpers

    private var baseColor: Color {
        colorScheme == .dark
            ? Color(red: 0.165, green: 0.176, blue: 0.204)  // #2a2d34
            : Color(red: 0.961, green: 0.961, blue: 0.961)  // #F5F5F5
    }

    /// Randomises position and size for each circle on every fresh appearance.
    /// Colors are assigned in order so all six brand colors always appear.
    private func generateCircles() {
        circles = colors.enumerated().map { i, color in
            CircleConfig(
                size:  sizes.randomElement()!,
                color: color,
                xFrac: CGFloat.random(in: 0.1...0.9),
                yFrac: CGFloat.random(in: 0.1...0.9),
                delay: Double(i) * 3.0  // 0, 3, 6, 9, 12, 15s — permanent phase stagger
            )
        }
    }
}

// MARK: - Circle model

private struct CircleConfig: Identifiable {
    let id    = UUID()
    let size:  CGFloat
    let color: Color
    let xFrac: CGFloat  // position as fraction of parent width
    let yFrac: CGFloat  // position as fraction of parent height
    let delay: Double
}

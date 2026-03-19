import SwiftUI

/// Matches the original button CSS:
///   background: rgba(42,45,52,0.03), darkens slightly on press
///   border-left: 2px solid var(--udu-green) → candu-blue on press
///   border-radius: 4px
///   font: Quicksand 14px weight 500
struct UcanduitButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.quicksand(14, weight: .medium))
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .background(
                Color(red: 0.165, green: 0.176, blue: 0.204)
                    .opacity(configuration.isPressed ? 0.08 : 0.03)
            )
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(alignment: .leading) {
                // The signature left border — green normally, blue on press
                RoundedRectangle(cornerRadius: 1)
                    .fill(
                        configuration.isPressed
                            ? Color(red: 0.247, green: 0.533, blue: 0.773)  // candu-blue
                            : Color(red: 0.306, green: 0.812, blue: 0.616)  // udu-green
                    )
                    .frame(width: 2)
            }
            .scaleEffect(y: configuration.isPressed ? 0.97 : 1.0)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == UcanduitButtonStyle {
    static var ucanduit: UcanduitButtonStyle { UcanduitButtonStyle() }
}

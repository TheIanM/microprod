//
//  ShimmerModifier.swift
//  ucanduit
//
//  Adapted from ShimmerLoadingCard in the Dropin-components snippet.
//  Provides a reusable .shimmer() modifier and placeholder shape utilities.
//
//  Usage:
//    RoundedRectangle(cornerRadius: 8)
//        .fill(.ultraThinMaterial)
//        .frame(height: 16)
//        .shimmer()

import SwiftUI

// MARK: - Shimmer Modifier

/// Sweeps a translucent gradient left-to-right over any view, simulating a loading shimmer.
/// Adapted from ShimmerLoadingCard in the Dropin-components snippet (repeatForever, linear).
struct ShimmerModifier: ViewModifier {
    @State private var offset: CGFloat = -400

    func body(content: Content) -> some View {
        content
            .overlay(
                shimmerOverlay
                    .clipped()
            )
            .onAppear {
                withAnimation(
                    .linear(duration: 1.6)
                    .repeatForever(autoreverses: false)
                ) {
                    offset = 400
                }
            }
    }

    private var shimmerOverlay: some View {
        Rectangle()
            .fill(
                LinearGradient(
                    gradient: Gradient(colors: [
                        .clear,
                        .white.opacity(0.25),
                        .white.opacity(0.45),
                        .white.opacity(0.25),
                        .clear
                    ]),
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .rotationEffect(.degrees(10))
            .offset(x: offset)
    }
}

extension View {
    func shimmer() -> some View {
        modifier(ShimmerModifier())
    }
}

// MARK: - Skeleton Pill

/// A single shimmering placeholder bar — mirrors a text or content block.
struct SkeletonPill: View {
    var width: CGFloat? = nil   // nil = maxWidth .infinity
    var height: CGFloat = 14
    var cornerRadius: CGFloat = 7

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(Color.white.opacity(0.08))
            .frame(width: width, height: height)
            .frame(maxWidth: width == nil ? .infinity : nil)
            .shimmer()
    }
}

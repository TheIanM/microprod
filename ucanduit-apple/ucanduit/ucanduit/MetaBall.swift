//
//  MetaBall.swift
//  ucanduit
//
//  Created by devian on 2026-02-26.
//
//  Standalone metaball demo adapted from the Canvas + symbols technique.
//  Reference: https://www.youtube.com/watch?v=xAf0Yw0E__Y
//  This is a scratchpad — the production implementation is in OscilloscopeView.swift

import SwiftUI

struct MetaBallDemoView: View {
    @State private var dragOffset: CGSize = .zero

    var body: some View {
        ZStack {
            Rectangle()
                .fill(gradientBackground)
                .mask {
                    CanvasView(dragOffset: $dragOffset)
                }
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            dragOffset = value.translation
                        }
                        .onEnded { _ in
                            resetDragOffset()
                        }
                )
        }
        .background(.black)
    }

    // MARK: - Computed Properties

    private var gradientBackground: LinearGradient {
        LinearGradient(
            colors: [Color("GColor1"), Color("Color2")],
            startPoint: .top,
            endPoint: .bottom
        )
    }

    // MARK: - Functions

    private func resetDragOffset() {
        withAnimation(.interactiveSpring(response: 0.65, dampingFraction: 0.75, blendDuration: 0.8)) {
            dragOffset = .zero
        }
    }
}

#Preview {
    MetaBallDemoView()
}

// MARK: - CanvasView

private struct CanvasView: View {
    @Binding var dragOffset: CGSize

    var body: some View {
        // The symbols: parameter registers SwiftUI views so the canvas can resolve and draw them.
        // Filters on the outer context apply to the drawLayer output as a whole —
        // blur runs first (last added = first applied), then alphaThreshold fuses overlapping balls.
        Canvas { context, size in
            context.addFilter(.alphaThreshold(min: 0.5, color: .yellow))
            context.addFilter(.blur(radius: 35))
            context.drawLayer { ctx in
                drawSymbols(in: ctx, size: size)
            }
        } symbols: {
            Ball()
                .tag(1)
            Ball(offset: dragOffset)
                .tag(2)
        }
    }

    private func drawSymbols(in ctx: GraphicsContext, size: CGSize) {
        for index in [1, 2] {
            if let resolvedView = ctx.resolveSymbol(id: index) {
                ctx.draw(resolvedView, at: CGPoint(x: size.width / 2, y: size.height / 2))
            }
        }
    }
}

// MARK: - Ball

private struct Ball: View {
    var offset: CGSize = .zero

    var body: some View {
        Circle()
            .fill(.white)
            .frame(width: 150, height: 150)
            .offset(offset)
    }
}

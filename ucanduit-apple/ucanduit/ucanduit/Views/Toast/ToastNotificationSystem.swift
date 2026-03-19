//
//  ToastNotificationSystem.swift
//  ucanduit
//
//  Ported from the toast-drop-ins snippet by M.Damra (2026-02-18).
//  Changes from the original:
//    - UIKit haptic calls wrapped in #if os(iOS) for macOS compatibility
//    - Demo view and BounceStyle removed (use .buttonStyle(.ucanduit) instead)
//
//  Usage:
//    1. Create @StateObject private var toastStore = ToastStore() in a parent view
//    2. Apply .toastHost(store: toastStore) to the root view
//    3. Pass down via .environmentObject(toastStore)
//    4. In child views: @EnvironmentObject var toastStore: ToastStore
//    5. toastStore.show("Saved!", type: .success)
//

import SwiftUI
import Combine

// MARK: - Toast Type

enum ToastType {
    case success
    case error
    case warning
    case info
    case custom(icon: String, color: Color)

    var icon: String {
        switch self {
        case .success:              return "checkmark.circle.fill"
        case .error:                return "xmark.circle.fill"
        case .warning:              return "exclamationmark.triangle.fill"
        case .info:                 return "info.circle.fill"
        case .custom(let icon, _):  return icon
        }
    }

    var color: Color {
        switch self {
        case .success:             return Color(red: 0.25, green: 0.78, blue: 0.48)
        case .error:               return Color(red: 0.93, green: 0.32, blue: 0.33)
        case .warning:             return Color(red: 0.98, green: 0.72, blue: 0.25)
        case .info:                return Color(red: 0.35, green: 0.58, blue: 0.96)
        case .custom(_, let col):  return col
        }
    }
}

// MARK: - Toast Position

enum ToastPosition {
    case top, bottom
}

// MARK: - Toast Style

enum ToastStyle {
    case glass      // frosted glass (default)
    case filled     // solid color fill
    case minimal    // thin accent line
}

// MARK: - Toast Item

struct ToastItem: Identifiable, Equatable {
    let id = UUID()
    let title: String
    var subtitle: String?
    let type: ToastType
    var style: ToastStyle = .glass
    var duration: TimeInterval = 3.0
    var hasProgress: Bool = false
    var action: ToastAction?
    var dismissible: Bool = true
    let createdAt = Date()

    static func == (lhs: ToastItem, rhs: ToastItem) -> Bool { lhs.id == rhs.id }
}

struct ToastAction {
    let label: String
    let handler: () -> Void
}

// MARK: - Toast Store

class ToastStore: ObservableObject {
    @Published var toasts: [ToastItem] = []
    var position: ToastPosition = .top
    var maxVisible: Int = 3

    func show(
        _ title: String,
        subtitle: String? = nil,
        type: ToastType = .info,
        style: ToastStyle = .glass,
        duration: TimeInterval = 3.0,
        hasProgress: Bool = false,
        action: ToastAction? = nil
    ) {
        let toast = ToastItem(
            title: title,
            subtitle: subtitle,
            type: type,
            style: style,
            duration: duration,
            hasProgress: hasProgress,
            action: action
        )

        withAnimation(.spring(response: 0.45, dampingFraction: 0.75)) {
            toasts.append(toast)
        }

        // Haptic feedback — iOS only (no haptics on macOS)
        #if os(iOS)
        switch type {
        case .success: UINotificationFeedbackGenerator().notificationOccurred(.success)
        case .error:   UINotificationFeedbackGenerator().notificationOccurred(.error)
        case .warning: UINotificationFeedbackGenerator().notificationOccurred(.warning)
        default:       UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
        #endif

        if duration > 0 {
            DispatchQueue.main.asyncAfter(deadline: .now() + duration) { [weak self] in
                self?.dismiss(toast.id)
            }
        }
    }

    func dismiss(_ id: UUID) {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
            toasts.removeAll { $0.id == id }
        }
    }

    func dismissAll() {
        withAnimation(.spring(response: 0.3)) { toasts.removeAll() }
    }
}

// MARK: - Toast Host Modifier

struct ToastHostModifier: ViewModifier {
    @ObservedObject var store: ToastStore

    func body(content: Content) -> some View {
        content.overlay(alignment: store.position == .top ? .top : .bottom) {
            ToastStackView(store: store)
        }
    }
}

extension View {
    func toastHost(store: ToastStore) -> some View {
        modifier(ToastHostModifier(store: store))
    }
}

// MARK: - Toast Stack View

struct ToastStackView: View {
    @ObservedObject var store: ToastStore

    var body: some View {
        let visible = Array(store.toasts.suffix(store.maxVisible))

        ZStack(alignment: store.position == .top ? .top : .bottom) {
            ForEach(Array(visible.enumerated()), id: \.element.id) { index, toast in
                let depth = visible.count - 1 - index
                let isTop = depth == 0

                ToastCardView(toast: toast, onDismiss: { store.dismiss(toast.id) })
                    .offset(y: offsetForDepth(depth))
                    .scaleEffect(
                        scaleForDepth(depth),
                        anchor: store.position == .top ? .top : .bottom
                    )
                    .opacity(opacityForDepth(depth))
                    .zIndex(Double(index))
                    .allowsHitTesting(isTop)
                    .transition(
                        .asymmetric(
                            insertion: .move(edge: store.position == .top ? .top : .bottom)
                                .combined(with: .opacity)
                                .combined(with: .scale(scale: 0.9)),
                            removal: .move(edge: store.position == .top ? .top : .bottom)
                                .combined(with: .opacity)
                                .combined(with: .scale(scale: 0.85))
                        )
                    )
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, store.position == .top ? 12 : 0)     // 12pt from top edge of panel
        .padding(.bottom, store.position == .bottom ? 16 : 0)
        .animation(.spring(response: 0.4, dampingFraction: 0.75), value: store.toasts)
    }

    private func offsetForDepth(_ depth: Int) -> CGFloat {
        let dir: CGFloat = store.position == .top ? 1 : -1
        return CGFloat(depth) * 8 * dir
    }

    private func scaleForDepth(_ depth: Int) -> CGFloat {
        max(1.0 - CGFloat(depth) * 0.05, 0.85)
    }

    private func opacityForDepth(_ depth: Int) -> Double {
        max(1.0 - Double(depth) * 0.2, 0.4)
    }
}

// MARK: - Toast Card View

struct ToastCardView: View {
    let toast: ToastItem
    let onDismiss: () -> Void

    @State private var dragOffset: CGFloat = 0
    @State private var progressValue: CGFloat = 1.0
    @State private var appeared = false

    var body: some View {
        HStack(spacing: 12) {
            iconView

            VStack(alignment: .leading, spacing: 2) {
                Text(toast.title)
                    .font(.quicksand(14, weight: .semibold))
                    .foregroundColor(titleColor)
                    .lineLimit(2)

                if let subtitle = toast.subtitle {
                    Text(subtitle)
                        .font(.quicksand(12))
                        .foregroundColor(subtitleColor)
                        .lineLimit(2)
                }
            }

            Spacer(minLength: 4)

            if let action = toast.action {
                Button {
                    #if os(iOS)
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    #endif
                    action.handler()
                    onDismiss()
                } label: {
                    Text(action.label)
                        .font(.quicksand(12, weight: .bold))
                        .foregroundColor(toast.type.color)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Capsule().fill(toast.type.color.opacity(0.15)))
                }
                .buttonStyle(.plain)
            } else if toast.dismissible {
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Color(white: 0.4))
                        .frame(width: 24, height: 24)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(cardBackground)
        .overlay(alignment: .bottom) {
            if toast.hasProgress && toast.duration > 0 {
                GeometryReader { geo in
                    RoundedRectangle(cornerRadius: 1)
                        .fill(toast.type.color.opacity(0.6))
                        .frame(width: geo.size.width * progressValue, height: 2)
                        .animation(.linear(duration: toast.duration), value: progressValue)
                }
                .frame(height: 2)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .padding(.horizontal, 1)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: shadowColor, radius: 12, y: 4)
        .offset(y: dragOffset)
        .gesture(swipeGesture)
        .scaleEffect(appeared ? 1 : 0.92)
        .onAppear {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) { appeared = true }
            if toast.hasProgress {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { progressValue = 0 }
            }
        }
    }

    // MARK: - Icon

    private var iconView: some View {
        ZStack {
            Circle()
                .fill(toast.type.color.opacity(iconBgOpacity))
                .frame(width: 32, height: 32)
            Image(systemName: toast.type.icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(toast.type.color)
        }
    }

    // MARK: - Style-dependent properties

    @ViewBuilder
    private var cardBackground: some View {
        switch toast.style {
        case .glass:
            ZStack {
                RoundedRectangle(cornerRadius: 16).fill(.ultraThinMaterial)
                RoundedRectangle(cornerRadius: 16).fill(Color(white: 0.06).opacity(0.85))
                RoundedRectangle(cornerRadius: 16).stroke(Color.white.opacity(0.08), lineWidth: 1)
            }
        case .filled:
            ZStack {
                RoundedRectangle(cornerRadius: 16).fill(toast.type.color.opacity(0.12))
                RoundedRectangle(cornerRadius: 16).stroke(toast.type.color.opacity(0.2), lineWidth: 1)
            }
        case .minimal:
            ZStack {
                RoundedRectangle(cornerRadius: 16).fill(Color(red: 0.08, green: 0.08, blue: 0.10))
                HStack {
                    RoundedRectangle(cornerRadius: 16).fill(toast.type.color).frame(width: 3)
                    Spacer()
                }
                RoundedRectangle(cornerRadius: 16).stroke(Color.white.opacity(0.06), lineWidth: 1)
            }
        }
    }

    private var titleColor: Color {
        switch toast.style {
        case .glass, .minimal: return .white
        case .filled: return toast.type.color
        }
    }

    private var subtitleColor: Color {
        switch toast.style {
        case .glass, .minimal: return Color(white: 0.5)
        case .filled: return toast.type.color.opacity(0.7)
        }
    }

    private var iconBgOpacity: Double {
        switch toast.style {
        case .glass: return 0.12
        case .filled: return 0.2
        case .minimal: return 0.12
        }
    }

    private var shadowColor: Color {
        switch toast.style {
        case .glass: return Color.black.opacity(0.2)
        case .filled: return toast.type.color.opacity(0.15)
        case .minimal: return Color.black.opacity(0.15)
        }
    }

    // MARK: - Swipe to Dismiss

    private var swipeGesture: some Gesture {
        DragGesture(minimumDistance: 8)
            .onChanged { value in
                if value.translation.height < 0 {
                    dragOffset = value.translation.height * 0.6
                } else {
                    dragOffset = value.translation.height * 0.15
                }
            }
            .onEnded { value in
                if value.translation.height < -40 || value.predictedEndTranslation.height < -100 {
                    withAnimation(.spring(response: 0.3)) { dragOffset = -200 }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { onDismiss() }
                } else {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) { dragOffset = 0 }
                }
            }
    }
}

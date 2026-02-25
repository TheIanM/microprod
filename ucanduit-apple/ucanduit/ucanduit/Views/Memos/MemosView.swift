import SwiftUI
import SwiftData

struct MemosView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Memo.updatedAt, order: .reverse) private var memos: [Memo]

    @State private var selectedMemo: Memo?

    var body: some View {
        // HSplitView is macOS-only — iOS gets a NavigationStack instead.
        // Full platform-specific layout is handled in Task 11 (Platform Integration).
        #if os(macOS)
        HSplitView {
            sidebarView
            detailView
        }
        .navigationTitle("Memos")
        #else
        NavigationStack {
            sidebarView
                .navigationTitle("Memos")
                .navigationDestination(for: Memo.self) { memo in
                    memoEditor(for: memo)
                }
        }
        #endif
    }

    // MARK: - Sidebar (memo list)

    private var sidebarView: some View {
        VStack {
            Button("New Memo") { createMemo() }
                .padding(8)

            List(memos, selection: $selectedMemo) { memo in
                VStack(alignment: .leading) {
                    Text(memo.title)
                        .font(.headline)
                        .lineLimit(1)
                    Text(memo.preview)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                    Text(memo.updatedAt, style: .relative)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                .tag(memo)
                .contextMenu {
                    Button("Delete", role: .destructive) { deleteMemo(memo) }
                }
            }
        }
        .frame(minWidth: 180, maxWidth: 250)
    }

    // MARK: - Detail (editor)

    private var detailView: some View {
        Group {
            if let memo = selectedMemo {
                memoEditor(for: memo)
            } else {
                ContentUnavailableView(
                    "No Memo Selected",
                    systemImage: "note.text",
                    description: Text("Select or create a memo")
                )
            }
        }
    }

    private func memoEditor(for memo: Memo) -> some View {
        TextEditor(text: Binding(
            get: { memo.content },
            set: { newValue in
                memo.content = newValue
                memo.updatedAt = Date()
                updateMemoMetadata(memo)
            }
        ))
        .font(.body)
        .padding()
    }

    // MARK: - Actions

    private func createMemo() {
        let memo = Memo(content: "")
        modelContext.insert(memo)
        selectedMemo = memo
    }

    private func deleteMemo(_ memo: Memo) {
        if selectedMemo == memo { selectedMemo = nil }
        modelContext.delete(memo)
    }

    /// Re-derives title and preview from content on every edit,
    /// matching the JS app's auto-title behavior.
    private func updateMemoMetadata(_ memo: Memo) {
        let firstLine = memo.content.components(separatedBy: .newlines).first ?? ""
        let cleaned = firstLine.replacingOccurrences(
            of: "[#*_`~\\[\\]()]",
            with: "",
            options: .regularExpression
        )
        memo.title = cleaned.trimmingCharacters(in: .whitespaces).isEmpty
            ? "Untitled Note"
            : String(cleaned.prefix(50))

        let plain = memo.content.replacingOccurrences(
            of: "[#*_`~\\[\\]()]",
            with: "",
            options: .regularExpression
        )
        memo.preview = String(plain.prefix(80))
    }
}

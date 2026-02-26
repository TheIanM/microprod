import SwiftUI
import SwiftData

struct MemosView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.isEmbedded) private var isEmbedded
    @Query(sort: \Memo.updatedAt, order: .reverse) private var memos: [Memo]

    @State private var selectedMemo: Memo?

    var body: some View {
        VStack(spacing: 0) {
            // Toolbar: new memo button
            HStack {
                Spacer()
                Button { createMemo() } label: {
                    HStack(spacing: 4) {
                        IconoirIcon("plus", size: 13)
                        Text("New Memo")
                    }
                }
                .buttonStyle(.ucanduit)
            }
            .padding(.bottom, 8)

            // Memo list — fixed height so it doesn't fight the outer ScrollView
            if memos.isEmpty {
                Text("No memos yet")
                    .font(.quicksand(13))
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 16)
            } else {
                List(memos, id: \.id, selection: $selectedMemo) { memo in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(memo.title)
                            .font(.quicksand(14, weight: .medium))
                            .lineLimit(1)
                        Text(memo.preview)
                            .font(.quicksand(12))
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                        Text(memo.updatedAt, style: .relative)
                            .font(.quicksand(11))
                            .foregroundStyle(.tertiary)
                    }
                    .tag(memo)
                    .contextMenu {
                        Button("Delete", role: .destructive) { deleteMemo(memo) }
                    }
                }
                .listStyle(.plain)
                // Cap list height: 3 rows max, then scroll internally
                .frame(height: min(CGFloat(memos.count) * 60 + 8, 188))
                .scrollDisabled(isEmbedded && memos.count <= 3)
            }

            // Selected memo editor — shown below the list
            if let memo = selectedMemo {
                Divider()
                    .padding(.vertical, 8)

                TextEditor(text: Binding(
                    get: { memo.content },
                    set: { newValue in
                        memo.content = newValue
                        memo.updatedAt = Date()
                        updateMemoMetadata(memo)
                    }
                ))
                .font(.quicksand(14))
                .frame(height: 120)
                .clipShape(RoundedRectangle(cornerRadius: 6))

                // Delete selected memo
                Button { deleteMemo(memo) } label: {
                    HStack(spacing: 4) {
                        IconoirIcon("trash", size: 13)
                        Text("Delete")
                    }
                }
                .buttonStyle(.ucanduit)
                .foregroundStyle(.red)
                .padding(.top, 4)
            }
        }
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

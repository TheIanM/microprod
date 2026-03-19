import Foundation
import SwiftData

@Model
final class Memo {
    var id: String
    var title: String
    var content: String
    var preview: String
    var createdAt: Date
    var updatedAt: Date

    init(content: String = "") {
        self.id = UUID().uuidString
        self.content = content
        self.createdAt = Date()
        self.updatedAt = Date()

        // Generate title from first line, stripping markdown characters
        let firstLine = content.components(separatedBy: .newlines).first ?? ""
        let cleaned = firstLine.replacingOccurrences(
            of: "[#*_`~\\[\\]()]",
            with: "",
            options: .regularExpression
        )
        self.title = String(cleaned.prefix(50)).isEmpty ? "Untitled Note" : String(cleaned.prefix(50))

        // Preview: first 80 chars of content with markdown stripped
        let plain = content.replacingOccurrences(
            of: "[#*_`~\\[\\]()]",
            with: "",
            options: .regularExpression
        )
        self.preview = String(plain.prefix(80))
    }
}

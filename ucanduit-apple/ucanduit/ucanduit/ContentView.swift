import SwiftUI

// Placeholder root view — will be replaced with the full navigation shell
// once all feature views are built (Tasks 3-11 in the implementation plan).
struct ContentView: View {
    var body: some View {
        VStack {
            Text("ucanduit")
                .font(.largeTitle)
            Text("Native Apple Edition")
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}

#Preview {
    ContentView()
}

// Word-level OCR via Apple Vision. Usage: ocr-words <image-path>
// Prints a JSON object {"words":[{"text","x","y","width","height"}],"width","height"}
// in the ORIGINAL image's pixel coordinates, origin top-left (matching WordBox in
// src/lib/api-types.ts). Compiled on first use by the /api/documents/[id]/words
// route: `swiftc scripts/ocr-words.swift -o scripts/ocr-words`.

import AppKit
import Foundation
import Vision

guard CommandLine.arguments.count > 1 else {
  FileHandle.standardError.write("usage: ocr-words <image-path>\n".data(using: .utf8)!)
  exit(1)
}

let path = CommandLine.arguments[1]
let url = URL(fileURLWithPath: path)

guard let image = NSImage(contentsOf: url),
  let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
else {
  FileHandle.standardError.write("failed to load image at \(path)\n".data(using: .utf8)!)
  exit(1)
}

let imgWidth = cgImage.width
let imgHeight = cgImage.height

struct WordBox: Codable {
  let text: String
  let x: Double
  let y: Double
  let width: Double
  let height: Double
}

struct Output: Codable {
  let words: [WordBox]
  let width: Int
  let height: Int
}

var words: [WordBox] = []
var requestError: Error?

let request = VNRecognizeTextRequest { request, error in
  if let error = error {
    requestError = error
    return
  }
  guard let observations = request.results as? [VNRecognizedTextObservation] else { return }

  for observation in observations {
    guard let candidate = observation.topCandidates(1).first else { continue }
    let text = candidate.string
    let nsText = text as NSString

    nsText.enumerateSubstrings(in: NSRange(location: 0, length: nsText.length), options: .byWords) {
      substring, substringRange, _, _ in
      guard let word = substring, !word.isEmpty else { return }
      guard let range = Range(substringRange, in: text) else { return }
      guard let box = try? candidate.boundingBox(for: range) else { return }

      // Vision's normalized rect: origin bottom-left, 0-1 of the full image. Convert
      // to top-left-origin pixel coordinates for the UI's WordBox contract.
      let rect = box.boundingBox
      let x = rect.origin.x * Double(imgWidth)
      let y = (1.0 - rect.origin.y - rect.height) * Double(imgHeight)
      let w = rect.width * Double(imgWidth)
      let h = rect.height * Double(imgHeight)
      words.append(WordBox(text: word, x: x, y: y, width: w, height: h))
    }
  }
}
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
  try handler.perform([request])
} catch {
  FileHandle.standardError.write("vision request failed: \(error)\n".data(using: .utf8)!)
  exit(1)
}

if let requestError = requestError {
  FileHandle.standardError.write("vision recognition failed: \(requestError)\n".data(using: .utf8)!)
  exit(1)
}

let output = Output(words: words, width: imgWidth, height: imgHeight)
let encoder = JSONEncoder()
if let data = try? encoder.encode(output), let json = String(data: data, encoding: .utf8) {
  print(json)
} else {
  FileHandle.standardError.write("failed to encode output\n".data(using: .utf8)!)
  exit(1)
}

import AppKit
import Foundation
import UserNotifications

let appName = "AO Notifier"
let appVersion = "0.6.0"
let bundleId = "com.aoagents.notifier"

struct NotifyPayload: Codable {
  struct Event: Codable {
    let id: String
    let type: String
    let priority: String
    let sessionId: String
    let projectId: String
    let timestamp: String
  }

  struct Action: Codable {
    let label: String
    let url: String?
  }

  let title: String
  let body: String
  let sound: Bool
  let defaultOpenUrl: String?
  let event: Event
  let actions: [Action]?
}

final class NotificationResponseDelegate: NSObject, UNUserNotificationCenterDelegate {
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let userInfo = response.notification.request.content.userInfo
    let actionIdentifier = response.actionIdentifier

    if actionIdentifier == UNNotificationDefaultActionIdentifier {
      openUrl(userInfo["defaultOpenUrl"] as? String)
      completionHandler()
      return
    }

    if let actionUrls = userInfo["actionUrls"] as? [String: String] {
      openUrl(actionUrls[actionIdentifier])
    }

    completionHandler()
  }
}

let delegate = NotificationResponseDelegate()

func jsonEscape(_ value: String) -> String {
  let data = try? JSONSerialization.data(withJSONObject: [value], options: [])
  let encoded = String(data: data ?? Data("[]".utf8), encoding: .utf8) ?? "[\"\"]"
  return String(encoded.dropFirst().dropLast())
}

func printJson(_ pairs: [(String, String)]) {
  let body = pairs.map { key, value in
    "\"\(key)\":\(jsonEscape(value))"
  }.joined(separator: ",")
  print("{\(body)}")
}

func openUrl(_ rawUrl: String?) {
  guard let rawUrl = rawUrl, let url = URL(string: rawUrl) else { return }
  NSWorkspace.shared.open(url)
}

func waitForSettings(_ center: UNUserNotificationCenter) -> UNNotificationSettings {
  let semaphore = DispatchSemaphore(value: 0)
  var resolved: UNNotificationSettings?
  center.getNotificationSettings { settings in
    resolved = settings
    semaphore.signal()
  }
  _ = semaphore.wait(timeout: .now() + 5)
  return resolved!
}

func permissionStatus() -> String {
  let settings = waitForSettings(UNUserNotificationCenter.current())
  switch settings.authorizationStatus {
  case .authorized:
    return "authorized"
  case .denied:
    return "denied"
  case .notDetermined:
    return "not_determined"
  case .provisional:
    return "provisional"
  case .ephemeral:
    return "ephemeral"
  @unknown default:
    return "unknown"
  }
}

func requestPermission() -> Bool {
  let center = UNUserNotificationCenter.current()
  let semaphore = DispatchSemaphore(value: 0)
  var granted = false
  center.requestAuthorization(options: [.alert, .sound]) { allowed, _ in
    granted = allowed
    semaphore.signal()
  }
  _ = semaphore.wait(timeout: .now() + 30)
  return granted
}

func decodePayload(_ base64: String) throws -> NotifyPayload {
  guard let data = Data(base64Encoded: base64) else {
    throw NSError(domain: appName, code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid base64 payload"])
  }
  return try JSONDecoder().decode(NotifyPayload.self, from: data)
}

func sendNotification(_ payload: NotifyPayload) throws {
  let center = UNUserNotificationCenter.current()
  center.delegate = delegate

  let urlActions = (payload.actions ?? []).enumerated().compactMap { index, action -> UNNotificationAction? in
    guard action.url != nil else { return nil }
    return UNNotificationAction(
      identifier: "ao.action.\(index)",
      title: action.label,
      options: [.foreground]
    )
  }

  let categoryId = "ao.event.\(payload.event.id)"
  if !urlActions.isEmpty {
    let category = UNNotificationCategory(
      identifier: categoryId,
      actions: urlActions,
      intentIdentifiers: [],
      options: []
    )
    center.setNotificationCategories([category])
  }

  let content = UNMutableNotificationContent()
  content.title = payload.title
  content.body = payload.body
  if payload.sound {
    content.sound = .default
  }
  if !urlActions.isEmpty {
    content.categoryIdentifier = categoryId
  }

  var actionUrls: [String: String] = [:]
  for (index, action) in (payload.actions ?? []).enumerated() {
    if let url = action.url {
      actionUrls["ao.action.\(index)"] = url
    }
  }

  var userInfo: [String: Any] = [
    "eventId": payload.event.id,
    "eventType": payload.event.type,
    "sessionId": payload.event.sessionId,
    "projectId": payload.event.projectId,
    "actionUrls": actionUrls,
  ]
  if let defaultOpenUrl = payload.defaultOpenUrl {
    userInfo["defaultOpenUrl"] = defaultOpenUrl
  }
  content.userInfo = userInfo

  let request = UNNotificationRequest(identifier: payload.event.id, content: content, trigger: nil)
  let semaphore = DispatchSemaphore(value: 0)
  var sendError: Error?
  center.add(request) { error in
    sendError = error
    semaphore.signal()
  }
  _ = semaphore.wait(timeout: .now() + 5)
  if let sendError = sendError {
    throw sendError
  }
}

func runCommand(_ args: [String]) -> Int32 {
  let center = UNUserNotificationCenter.current()
  center.delegate = delegate

  guard let command = args.first else {
    RunLoop.current.run(until: Date().addingTimeInterval(5))
    return 0
  }

  do {
    switch command {
    case "--version-json":
      printJson([
        ("name", appName),
        ("version", appVersion),
        ("bundleId", bundleId),
      ])
      return 0
    case "--permission-status-json":
      printJson([
        ("status", permissionStatus()),
        ("bundleId", bundleId),
      ])
      return 0
    case "--request-permission":
      let granted = requestPermission()
      printJson([
        ("status", granted ? "authorized" : permissionStatus()),
        ("bundleId", bundleId),
      ])
      return granted ? 0 : 2
    case "--notify-base64":
      guard args.count >= 2 else {
        fputs("Missing --notify-base64 payload\n", stderr)
        return 64
      }
      let status = permissionStatus()
      if status == "not_determined" {
        _ = requestPermission()
      }
      try sendNotification(decodePayload(args[1]))
      return 0
    default:
      fputs("Unknown command: \(command)\n", stderr)
      return 64
    }
  } catch {
    fputs("\(error.localizedDescription)\n", stderr)
    return 1
  }
}

exit(runCommand(Array(CommandLine.arguments.dropFirst())))

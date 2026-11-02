import { describe, expect, it } from "vitest";
import { parseTerminalIngest, parseTerminalIngestBuffer } from "../src/modules/tabel/hikvision-ingest.pure";

describe("Hikvision terminal ingest", () => {
  it("keeps the employee code and check-in direction", () => {
    const parsed = parseTerminalIngest({
      eventType: "AccessControllerEvent",
      AccessControllerEvent: {
        majorEventType: 5,
        subEventType: 75,
        employeeNoString: "PMAND008",
        attendanceStatus: "checkIn"
      }
    });
    expect(parsed.employeeNo).toBe("PMAND008");
    expect(parsed.direction).toBe("IN");
  });

  it("ignores heartbeat and a failed face", () => {
    expect(parseTerminalIngest({ eventType: "heartBeat" }).employeeNo).toBe("");
    expect(
      parseTerminalIngest({
        AccessControllerEvent: { subEventType: 76, employeeNoString: "PMAND008" }
      }).employeeNo
    ).toBe("");
  });

  it("reads a nested alert and a photo field", () => {
    const parsed = parseTerminalIngest({
      EventNotificationAlert: {
        AccessControllerEvent: {
          employeeNoString: "PMAND008",
          attendanceStatus: "checkOut",
          picture: `data:image/jpeg;base64,${"A".repeat(220)}`
        }
      }
    });
    expect(parsed.employeeNo).toBe("PMAND008");
    expect(parsed.direction).toBe("OUT");
    expect(parsed.photoBase64).toBe("A".repeat(220));
  });

  it("reads an XML event from the terminal", () => {
    const parsed = parseTerminalIngest(
      "<EventNotificationAlert><employeeNoString>PMAND008</employeeNoString><subEventType>75</subEventType><attendanceStatus>checkIn</attendanceStatus></EventNotificationAlert>"
    );
    expect(parsed.employeeNo).toBe("PMAND008");
    expect(parsed.direction).toBe("IN");
  });

  it("reads the terminal jpeg that follows the event json", () => {
    const json = Buffer.from(
      JSON.stringify({
        eventType: "AccessControllerEvent",
        AccessControllerEvent: { subEventType: 75, employeeNoString: "PMAND008", attendanceStatus: "checkIn" }
      })
    );
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(800, 1), Buffer.from([0xff, 0xd9])]);
    const parsed = parseTerminalIngestBuffer(Buffer.concat([json, jpeg]));
    expect(parsed.employeeNo).toBe("PMAND008");
    expect((parsed.photoBase64 ?? "").length).toBeGreaterThan(100);
  });
});

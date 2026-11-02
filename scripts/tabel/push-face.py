"""Write one employee and JPEG onto a Hikvision terminal. Stdlib only."""
import hashlib
import http.client
import os
import re
import sys


def md5(value: str) -> str:
    return hashlib.md5(value.encode()).hexdigest()


def digest(host: str, method: str, path: str, user: str, password: str, body: bytes, content_type: str) -> tuple[int, str]:
    conn = http.client.HTTPConnection(host, 80, timeout=20)
    conn.request(method, path)
    resp = conn.getresponse()
    www = resp.getheader("WWW-Authenticate") or ""
    resp.read()

    def field(name: str) -> str:
        match = re.search(name + r'="([^"]*)"', www)
        return match.group(1) if match else ""

    realm, nonce, opaque = field("realm"), field("nonce"), field("opaque")
    qop = (field("qop") or "auth").split(",")[0].strip()
    nc, cnonce = "00000001", os.urandom(8).hex()
    ha1 = md5(f"{user}:{realm}:{password}")
    ha2 = md5(f"{method}:{path}")
    response = md5(f"{ha1}:{nonce}:{nc}:{cnonce}:{qop}:{ha2}")
    auth = (
        f'Digest username="{user}", realm="{realm}", nonce="{nonce}", uri="{path}", '
        f'qop={qop}, nc={nc}, cnonce="{cnonce}", response="{response}"'
    )
    if opaque:
        auth += f', opaque="{opaque}"'
    conn = http.client.HTTPConnection(host, 80, timeout=30)
    conn.request(method, path, body=body, headers={"Authorization": auth, "Content-Type": content_type})
    done = conn.getresponse()
    return done.status, done.read().decode("utf-8", "replace")


def main() -> int:
    host, user, password, emp, name, jpg = sys.argv[1:7]
    user_body = (
        '{"UserInfo":{"employeeNo":"%s","name":"%s","userType":"normal",'
        '"Valid":{"enable":true,"beginTime":"2017-08-01T00:00:00","endTime":"2037-12-31T23:59:59","timeType":"local"},'
        '"doorRight":"1","RightPlan":[{"doorNo":1,"planTemplateNo":"1"}]}}'
        % (emp, name.replace('"', "")[:32])
    ).encode()
    code, text = digest(host, "PUT", "/ISAPI/AccessControl/UserInfo/SetUp?format=json", user, password, user_body, "application/json")
    if "lock" in text and "lockStatus" in text:
        print("LOCKED")
        return 3
    if code == 401 or "Unauthorized" in text:
        print("UNAUTHORIZED")
        return 3
    if code >= 400 and '"statusCode":1' not in text.replace(" ", "") and "ok" not in text.lower():
        print("USER_FAIL")
        return 4
    if not os.path.isfile(jpg) or os.path.getsize(jpg) < 32:
        print("OK")
        return 0
    jpeg = open(jpg, "rb").read()
    record = ('{"faceLibType":"blackFD","FDID":"1","FPID":"%s","employeeNo":"%s"}' % (emp, emp)).encode()
    boundary = "----SALEC" + os.urandom(8).hex()
    body = b"".join(
        [
            f'--{boundary}\r\nContent-Disposition: form-data; name="FaceDataRecord"\r\nContent-Type: application/json\r\n\r\n'.encode()
            + record,
            f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="FaceImage"; filename="face.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'.encode()
            + jpeg,
            f"\r\n--{boundary}--\r\n".encode(),
        ]
    )
    code, text = digest(
        host,
        "POST",
        "/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json",
        user,
        password,
        body,
        f"multipart/form-data; boundary={boundary}",
    )
    if code < 400 and "ok" in text.lower():
        print("OK")
        return 0
    print("FACE_FAIL")
    return 4


if __name__ == "__main__":
    raise SystemExit(main())

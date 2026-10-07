"""不依赖 JDK / apksigner，直接解析 APK v2 签名块并校验证书。

用途：本机没有 JDK 时，也能确认一个 APK 是不是用你自己的密钥签的。

用法：
    python scripts/verify-apk-signature.py <apk路径>
    python scripts/verify-apk-signature.py <apk路径> --expect <cert.pem>

原理：
    APK Signing Block 位于 ZIP 中央目录之前，以魔数 "APK Sig Block 42" 结尾。
    其中 ID 0x7109871a 为 APK Signature Scheme v2 块，里面按
    signers → signed data → certificates 的嵌套长度前缀结构存放着
    DER 编码的 X.509 证书。这里手动把这个结构剥出来，
    再和 cert.pem 的 DER SHA-256 比对。
"""

from __future__ import annotations

import base64
import hashlib
import struct
import sys
from pathlib import Path

MAGIC = b"APK Sig Block 42"
V2_BLOCK_ID = 0x7109871A


def read_len_prefixed(buf: bytes, off: int, size_bytes: int = 4) -> tuple[bytes, int]:
    if size_bytes == 4:
        n = struct.unpack_from("<I", buf, off)[0]
    else:
        n = struct.unpack_from("<Q", buf, off)[0]
    start = off + size_bytes
    return buf[start : start + n], start + n


def find_signing_block(data: bytes) -> tuple[int, int]:
    """返回 (块起始偏移, 魔数偏移)。

    块布局（N 为长度字段的值）：
        [0..7]      uint64 N            ← 块起始
        [8..]       ID-value 对
        [..]        uint64 N            ← 魔数前 8 字节
        [..]        16 字节魔数
    总长 = 8 + N，且魔数位于块末尾。因此：
        block_start = magic_off + 16 - (8 + N) = magic_off + 8 - N
    """
    magic_off = data.rfind(MAGIC)
    if magic_off < 0:
        raise SystemExit("✘ 未找到 APK Signing Block —— 这个 APK 没有 v2/v3 签名")

    size2 = struct.unpack_from("<Q", data, magic_off - 8)[0]
    block_start = magic_off + 8 - size2
    if block_start < 0:
        raise SystemExit(f"✘ 签名块长度异常：{size2}")

    size1 = struct.unpack_from("<Q", data, block_start)[0]
    if size1 != size2:
        raise SystemExit(f"✘ 签名块长度字段自相矛盾：{size1} != {size2}")
    return block_start, magic_off


def extract_v2_certs(value: bytes) -> list[bytes]:
    """signers → signer → signed data → certificates"""
    signers, _ = read_len_prefixed(value, 0)
    signer, _ = read_len_prefixed(signers, 0)
    signed_data, _ = read_len_prefixed(signer, 0)
    _digests, off = read_len_prefixed(signed_data, 0)
    cert_seq, _ = read_len_prefixed(signed_data, off)

    certs: list[bytes] = []
    pos = 0
    while pos < len(cert_seq):
        cert, pos = read_len_prefixed(cert_seq, pos)
        certs.append(cert)
    return certs


def collect_certs(data: bytes) -> dict[str, list[bytes]]:
    block_start, magic_off = find_signing_block(data)
    found: dict[str, list[bytes]] = {}

    pos = block_start + 8
    end = magic_off - 8
    while pos < end:
        ln = struct.unpack_from("<Q", data, pos)[0]
        pair_id = struct.unpack_from("<I", data, pos + 8)[0]
        value = data[pos + 12 : pos + 8 + ln]
        if pair_id == V2_BLOCK_ID:
            try:
                found["v2"] = extract_v2_certs(value)
            except Exception as exc:  # noqa: BLE001
                found["v2_error"] = [str(exc).encode()]  # type: ignore[list-item]
        else:
            found.setdefault("other", []).append(pair_id.to_bytes(4, "little"))
        pos += 8 + ln
    return found


def pem_to_der(pem_path: Path) -> bytes:
    text = pem_path.read_text(encoding="utf-8", errors="ignore")
    body = "".join(
        line.strip()
        for line in text.splitlines()
        if line.strip() and not line.startswith("-----")
    )
    return base64.b64decode(body)


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2

    apk = Path(sys.argv[1])
    if not apk.exists():
        raise SystemExit(f"✘ 找不到文件：{apk}")

    expect: Path | None = None
    if "--expect" in sys.argv:
        expect = Path(sys.argv[sys.argv.index("--expect") + 1])

    data = apk.read_bytes()
    print(f"APK      : {apk}")
    print(f"大小     : {len(data)} 字节")

    blocks = collect_certs(data)
    if "v2_error" in blocks:
        raise SystemExit(f"✘ 解析 v2 块失败：{blocks['v2_error'][0].decode(errors='ignore')}")

    certs = blocks.get("v2", [])
    if not certs:
        raise SystemExit("✘ 签名块里没有找到 v2 证书")

    print(f"签名方案 : APK Signature Scheme v2（{len(certs)} 张证书）")

    ok = True
    expected_hash = None
    if expect and expect.exists():
        expected_hash = hashlib.sha256(pem_to_der(expect)).hexdigest()
        print(f"期望证书 : {expect}")
        print(f"  其 SHA-256(DER): {fmt(expected_hash)}")

    for i, cert in enumerate(certs):
        digest = hashlib.sha256(cert).hexdigest()
        print(f"  [{i}] SHA-256(DER): {fmt(digest)}  （{len(cert)} 字节）")

    if expected_hash:
        match = any(hashlib.sha256(c).hexdigest() == expected_hash for c in certs)
        if match:
            print("\n✔ 一致：这个 APK 确实是用你提供的证书签名的")
        else:
            print("\n✘ 不一致：APK 的签名证书与你提供的 cert 不是同一个！")
            ok = False

    return 0 if ok else 1


def fmt(hexdigest: str) -> str:
    upper = hexdigest.upper()
    return ":".join(upper[i : i + 2] for i in range(0, len(upper), 2))


if __name__ == "__main__":
    raise SystemExit(main())

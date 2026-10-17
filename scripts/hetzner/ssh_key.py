#!/usr/bin/env python3
import sys
import paramiko

host = "157.180.116.50"
key_path = sys.argv[1]
cmd = sys.argv[2]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    host,
    username="root",
    key_filename=key_path,
    timeout=30,
    allow_agent=False,
    look_for_keys=False,
)
stdin, stdout, stderr = client.exec_command(cmd, timeout=600)
sys.stdout.write(stdout.read().decode("utf-8", "replace"))
sys.stderr.write(stderr.read().decode("utf-8", "replace"))
code = stdout.channel.recv_exit_status()
client.close()
sys.exit(code)

#!/usr/bin/env python3
"""Replace byte-identical native skill copies with links to ~/.agents/skills.

Keeps client-specific/system skills and differing copies. No credentials are changed.
Optional --bootstrap FILE updates the one shared Skillbox entry before linking its adapters.
"""
import argparse, datetime, hashlib, json, os, shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--bootstrap',type=Path);p.add_argument('--apply',action='store_true');args=p.parse_args()
root=Path.home();shared=root/'.agents/skills';back=root/'.local/state/skillbox'/('shared-skills-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
def fingerprint(folder):
    return [(str(f.relative_to(folder)),hashlib.sha256(f.read_bytes()).hexdigest(),f.stat().st_mode&0o111) for f in sorted(folder.rglob('*')) if f.is_file()]
def preserve(path):
    back.mkdir(parents=True,exist_ok=True,mode=0o700)
    dest=back/str(path.relative_to(root)).replace('/','__')
    shutil.move(str(path),str(dest))
report={'linked':[],'alreadyShared':[],'retainedDifferent':[],'retainedClientOnly':[]}
for client in ['codex','claude','cursor']:
    directory=root/f'.{client}/skills'
    if not directory.exists():continue
    if directory.resolve()==shared.resolve():report['alreadyShared'].append(client+': whole directory');continue
    for source in sorted(directory.iterdir()):
        if not source.is_dir() or source.name.startswith('.'):continue
        target=shared/source.name
        if source.resolve()==target.resolve():report['alreadyShared'].append(client+': '+source.name);continue
        if not target.is_dir():report['retainedClientOnly'].append(client+': '+source.name);continue
        if fingerprint(source)!=fingerprint(target):report['retainedDifferent'].append(client+': '+source.name);continue
        report['linked'].append(client+': '+source.name)
        if args.apply:
            preserve(source);source.symlink_to(os.path.relpath(target,source.parent),target_is_directory=True)
if args.bootstrap:
    contents=args.bootstrap.read_bytes();target=shared/'skills-library/SKILL.md'
    if args.apply:
        target.parent.mkdir(parents=True,exist_ok=True)
        if target.exists() and target.read_bytes()!=contents:preserve(target)
        tmp=target.with_suffix('.tmp');tmp.write_bytes(contents);tmp.chmod(0o644);os.replace(tmp,target)
    # A client with no copy still needs its supported discovery location.
    for client in ['claude','cursor']:
        d=root/f'.{client}/skills'
        if not d.exists():continue
        adapter=d/'skills-library'
        if not adapter.exists() and args.apply:adapter.symlink_to(os.path.relpath(target.parent,adapter.parent),target_is_directory=True)
report['applied']=args.apply;report['backup']=str(back) if back.exists() else None
print(json.dumps(report,indent=2))

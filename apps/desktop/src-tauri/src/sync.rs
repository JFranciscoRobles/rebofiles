// The folder of the disk the page keeps as a folder of the drive: what the
// sync engine of @rebofiles/sync asks of a disk, read and written here, as the
// page cannot. Every path is from the folder synced, with `/` between, and
// none may leave it. Its own folder, `.rebofiles`, and the files of the
// systems are never listed, as on Node.

use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::Manager;

const OWN: &str = ".rebofiles";

#[derive(Serialize)]
pub struct LocalEntry {
    path: String,
    kind: &'static str,
    size: u64,
    modified: u64,
}

fn ignored(name: &str) -> bool {
    let lower = name.to_lowercase();
    name == OWN
        || [".ds_store", "thumbs.db", "desktop.ini", ".spotlight-v100", ".trashes", ".fseventsd"].contains(&lower.as_str())
        || name.starts_with("~$")
        || name.starts_with("._")
        || (name.starts_with(".~lock.") && name.ends_with('#'))
        || lower.ends_with(".tmp")
        || lower.ends_with(".swp")
}

/// `path` inside `root`, refused when any part of it would leave it.
fn inside(root: &str, path: &str) -> Result<PathBuf, String> {
    let mut full = PathBuf::from(root);
    for part in Path::new(path).components() {
        match part {
            Component::Normal(name) => full.push(name),
            Component::CurDir => {}
            _ => return Err(format!("{path} is outside the folder.")),
        }
    }
    Ok(full)
}

fn entry_of(root: &str, path: &str) -> Option<LocalEntry> {
    let meta = fs::metadata(inside(root, path).ok()?).ok()?;
    let modified = meta.modified().ok()?.duration_since(UNIX_EPOCH).ok()?.as_millis() as u64;
    Some(LocalEntry { path: path.to_string(), kind: if meta.is_dir() { "folder" } else { "file" }, size: if meta.is_dir() { 0 } else { meta.len() }, modified })
}

fn header(request: &Request, name: &str) -> Result<String, String> {
    let raw = request.headers().get(name).and_then(|v| v.to_str().ok()).ok_or(format!("No {name}."))?;
    // Sent encoded, as a header is ASCII and a name may not be.
    let bytes: Vec<u8> = {
        let mut out = Vec::new();
        let b = raw.as_bytes();
        let mut i = 0;
        while i < b.len() {
            if b[i] == b'%' && i + 2 < b.len() {
                let hex = std::str::from_utf8(&b[i + 1..i + 3]).map_err(|e| e.to_string())?;
                out.push(u8::from_str_radix(hex, 16).map_err(|e| e.to_string())?);
                i += 3;
            } else {
                out.push(b[i]);
                i += 1;
            }
        }
        out
    };
    String::from_utf8(bytes).map_err(|e| e.to_string())
}

/// Where a folder synced goes unless one says another: ReboFiles, in the home folder.
#[tauri::command]
pub fn sync_default_folder(app: tauri::AppHandle) -> Result<String, String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    Ok(home.join("ReboFiles").to_string_lossy().into_owned())
}

#[tauri::command]
pub fn sync_list(root: String) -> Result<Vec<LocalEntry>, String> {
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let mut found = Vec::new();
    let mut stack = vec![String::new()];
    while let Some(dir) = stack.pop() {
        let read = match fs::read_dir(inside(&root, &dir)?) {
            Ok(read) => read,
            Err(_) => continue,
        };
        for item in read.flatten() {
            let name = item.file_name().to_string_lossy().into_owned();
            let kind = match item.file_type() {
                Ok(kind) if !kind.is_symlink() => kind,
                _ => continue,
            };
            if ignored(&name) {
                continue;
            }
            let path = if dir.is_empty() { name } else { format!("{dir}/{name}") };
            if let Some(entry) = entry_of(&root, &path) {
                found.push(entry);
            }
            if kind.is_dir() {
                stack.push(path);
            }
        }
    }
    Ok(found)
}

/// The bytes, as they are: an ArrayBuffer in the page, not a list of numbers.
#[tauri::command]
pub fn sync_read(root: String, path: String) -> Result<Response, String> {
    fs::read(inside(&root, &path)?).map(Response::new).map_err(|e| e.to_string())
}

/// The bytes of the body put at the path of the headers, whole or not at all.
#[tauri::command]
pub fn sync_write(request: Request) -> Result<LocalEntry, String> {
    let root = header(&request, "x-root")?;
    let path = header(&request, "x-path")?;
    let InvokeBody::Raw(bytes) = request.body() else { return Err("The bytes are the body.".into()) };
    let target = inside(&root, &path)?;
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let partial = PathBuf::from(&root).join(OWN).join("partial").join(stamp.to_string());
    fs::create_dir_all(partial.parent().unwrap()).map_err(|e| e.to_string())?;
    fs::write(&partial, bytes).map_err(|e| e.to_string())?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::rename(&partial, &target).map_err(|e| e.to_string())?;
    entry_of(&root, &path).ok_or("It was not written.".into())
}

#[tauri::command]
pub fn sync_mkdir(root: String, path: String) -> Result<(), String> {
    fs::create_dir_all(inside(&root, &path)?).map_err(|e| e.to_string())
}

/// Aside, in `.rebofiles/removed/<when>/`, not gone: the drive has it in its trash too.
#[tauri::command]
pub fn sync_remove(root: String, path: String) -> Result<(), String> {
    let from = inside(&root, &path)?;
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    let kept = inside(&PathBuf::from(&root).join(OWN).join("removed").join(stamp.to_string()).to_string_lossy(), &path)?;
    fs::create_dir_all(kept.parent().unwrap()).map_err(|e| e.to_string())?;
    if fs::rename(&from, &kept).is_err() {
        if from.is_dir() { fs::remove_dir_all(&from) } else { fs::remove_file(&from) }.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn sync_move(root: String, from: String, to: String) -> Result<(), String> {
    let target = inside(&root, &to)?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::rename(inside(&root, &from)?, target).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn sync_stat(root: String, path: String) -> Option<LocalEntry> {
    entry_of(&root, &path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_path_never_leaves_the_folder() {
        assert!(inside("/tmp/x", "a/b.txt").is_ok());
        assert!(inside("/tmp/x", "../etc/passwd").is_err());
        assert!(inside("/tmp/x", "/etc/passwd").is_err());
        assert!(inside("/tmp/x", "a/../../b").is_err());
    }

    #[test]
    fn lists_what_is_synced_and_not_the_rest() {
        let root = std::env::temp_dir().join(format!("rebofiles-sync-{}", std::process::id()));
        let root_s = root.to_string_lossy().into_owned();
        fs::create_dir_all(root.join("Clients")).unwrap();
        fs::create_dir_all(root.join(OWN)).unwrap();
        fs::write(root.join("Clients/contract.txt"), "signed").unwrap();
        fs::write(root.join(".DS_Store"), "").unwrap();
        fs::write(root.join("~$report.docx"), "").unwrap();
        let mut paths: Vec<String> = sync_list(root_s.clone()).unwrap().into_iter().map(|e| e.path).collect();
        paths.sort();
        assert_eq!(paths, vec!["Clients", "Clients/contract.txt"]);
        sync_move(root_s.clone(), "Clients/contract.txt".into(), "Archive/2026/contract.txt".into()).unwrap();
        assert!(root.join("Archive/2026/contract.txt").exists());
        sync_remove(root_s.clone(), "Archive".into()).unwrap();
        assert!(!root.join("Archive").exists());
        assert_eq!(sync_stat(root_s.clone(), "Clients".into()).map(|e| e.kind), Some("folder"));
        fs::remove_dir_all(&root).unwrap();
    }
}

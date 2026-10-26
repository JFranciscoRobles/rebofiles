// The application around the page: its window, its menu, and where what is
// downloaded from the drive goes. Everything else is the page's, as in a
// browser.

// No console of its own on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{Path, PathBuf};
use tauri::menu::{Menu, MenuItem, Submenu};
use tauri::webview::DownloadEvent;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

/// A path in `folder` for `name` that is not taken: "name (2).ext" when it is, as the drive names a copy.
fn free_path(folder: &Path, name: &str) -> PathBuf {
    let first = folder.join(name);
    if !first.exists() {
        return first;
    }
    let (base, ext) = match name.rfind('.') {
        Some(dot) if dot > 0 => (&name[..dot], &name[dot..]),
        _ => (name, ""),
    };
    (2..)
        .map(|n| folder.join(format!("{base} ({n}){ext}")))
        .find(|path| !path.exists())
        .expect("a free name")
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // The menu of a Mac as it is, with one more: the server the window is of.
            let menu = Menu::default(app.handle())?;
            let change = MenuItem::with_id(app, "change-server", "Change Server…", true, Some("CmdOrCtrl+Shift+K"))?;
            menu.append(&Submenu::with_items(app, "Server", true, &[&change])?)?;
            app.set_menu(menu)?;
            app.on_menu_event(|app, event| {
                if event.id() == "change-server" {
                    let _ = app.emit("change-server", ());
                }
            });

            let downloads = app.path().download_dir().unwrap_or_else(|_| std::env::temp_dir());
            WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("ReboFiles")
                .inner_size(1200.0, 800.0)
                .min_inner_size(720.0, 480.0)
                // A file or a .zip downloaded goes to Downloads, under its own name or a free one beside it.
                .on_download(move |_, event| {
                    if let DownloadEvent::Requested { destination, .. } = event {
                        let name = destination.file_name().and_then(|n| n.to_str()).unwrap_or("download").to_string();
                        *destination = free_path(&downloads, &name);
                    }
                    true
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("the application could not start");
}

#[cfg(test)]
mod tests {
    use super::free_path;
    use std::fs;

    #[test]
    fn a_name_taken_is_made_free_as_the_drive_does() {
        let folder = std::env::temp_dir().join(format!("rebofiles-desktop-{}", std::process::id()));
        fs::create_dir_all(&folder).unwrap();
        assert_eq!(free_path(&folder, "a.txt"), folder.join("a.txt"));
        fs::write(folder.join("a.txt"), "").unwrap();
        fs::write(folder.join("a (2).txt"), "").unwrap();
        assert_eq!(free_path(&folder, "a.txt"), folder.join("a (3).txt"));
        fs::write(folder.join("notes"), "").unwrap();
        assert_eq!(free_path(&folder, "notes"), folder.join("notes (2)"));
        fs::remove_dir_all(&folder).unwrap();
    }
}

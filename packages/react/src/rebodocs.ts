// Word documents previewed with Rebodocs' engine, as @rebofiles/drive reads
// them: apart from the rest of the package, so that a drive without Rebodocs
// does not carry it.
//
//   import { previewDocx } from '@rebofiles/react/rebodocs';
//   <FileDrive previewDocument={previewDocx} viewDocument={viewDocx} />

export { type DocumentLayout, type DocumentView, previewDocx, thumbDocx, viewDocx } from '@rebofiles/drive/rebodocs';

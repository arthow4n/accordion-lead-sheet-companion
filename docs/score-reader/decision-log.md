# Score reader decision and authority log

This is the authority gate for choices that an implementation agent must not infer. `pending` means
the agent may evaluate and document options but must stop before making the consequential choice.
The owner is the user/project owner unless changed explicitly.

| Decision                            | Owner              | Status  | Required evidence or approval                                                                                                                                                                                           |
| ----------------------------------- | ------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supported CBA keyboard profiles     | User/project owner | pending | Approve each layout's display name, rows, button/column bounds, lowest/highest sounding pitch, reference coordinate/pitch, orientation, and authoritative source before M4A.                                            |
| Fixture and private-data provenance | User/project owner | pending | Approve fixture manifest rows and any private benchmark use; private class photograph remains excluded.                                                                                                                 |
| Dependency licenses and notices     | User/project owner | pending | Evaluated OSMD 2.1.2 (BSD-3-Clause), fflate 0.8.3 (MIT), and @xmldom/xmldom 0.9.12 (MIT) for this slice; approve exact versions/licenses for these plus OpenCV.js, Tesseract.js, ONNX Runtime Web, and model artifacts. |
| OMR candidate and redistribution    | User/project owner | pending | Approve JAZZMUS weights/tokenizer/preprocessing license and any external artifact distribution.                                                                                                                         |
| Benchmark device/profile            | User/project owner | pending | Name representative Android Chromium and iPhone Safari devices plus CPU/RAM/browser versions.                                                                                                                           |
| OMR numeric gates                   | User/project owner | pending | Approve the frozen corpus split and accuracy/performance thresholds before final evaluation.                                                                                                                            |
| Artifact host/CORS/retention        | User/project owner | pending | Approve URL host, CORS policy, cache/retention period, and upload action.                                                                                                                                               |
| Reduced `OMR_NO_GO` release         | User/project owner | pending | Explicitly approve or reject shipping MusicXML plus guided-photo/manual-chord mode without photo melody recognition.                                                                                                    |
| OSMD fallback                       | User/project owner | pending | Approve sanitized full-score OSMD or a separately scoped renderer if bounded excerpt strategies fail.                                                                                                                   |

The implementation agent may fill `evidence` in commit notes and change `status` only when the owner
has supplied approval in the project conversation or an explicitly recorded project decision.

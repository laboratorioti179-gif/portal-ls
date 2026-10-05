                            accept="image/*,.pdf" 
                            className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                            onChange={e => setSelectedFile(e.target.files[0])}
                            disabled={loading}
                         />
                         {selectedFile && (
                            <button 
                              onClick={() => handleUploadReceipt(selectedPayId, selectedFile)}
                              disabled={loading}
                              className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-2.5 px-4 rounded-lg transition-colors disabled:opacity-70 shadow-sm"
                            >
                              {loading ? 'Enviando...' : 'Enviar pagamento'}
                            </button>
                         )}
                      </div>
                   )}
                </div>
            )}

            <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-sm">
              <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Descrição da Parcela</th>
                    <th className="px-5 py-4 font-semibold">Vencimento</th>
                    <th className="px-5 py-4 font-semibold">Valor</th>
                    <th className="px-5 py-4 font-semibold text-right">Status do Pagamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myFinancials.sort((a,b) => sortOrder === 'asc' ? new Date(b.dueDate) - new Date(a.dueDate) : new Date(a.dueDate) - new Date(b.dueDate)).map(f => (
                     <tr key={f.id} className={`hover:bg-slate-50 transition-all ${f.status === 'paid' ? 'bg-emerald-50/40' : f.status === 'in_review' ? 'bg-blue-50/40' : ''}`}>
                       <td className={`px-5 py-4 font-bold ${f.status === 'paid' ? 'text-emerald-900' : f.status === 'in_review' ? 'text-blue-900' : 'text-slate-800'}`}>
                         {f.description}
                       </td>
                       <td className={`px-5 py-4 font-medium ${f.status === 'paid' ? 'text-emerald-700' : f.status === 'in_review' ? 'text-blue-700' : 'text-slate-600'}`}>
                         {new Date(f.dueDate).toLocaleDateString()}
                       </td>
                       <td className={`px-5 py-4 font-black ${f.status === 'paid' ? 'text-emerald-700' : f.status === 'in_review' ? 'text-blue-700' : 'text-blue-600'}`}>
                         R$ {f.amount}
                       </td>
                       <td className="px-5 py-4 text-right align-middle">
                         {f.status === 'paid' ? (
                           <div className="flex flex-col items-end">
                             <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 w-max ml-auto">
                               <CheckCircle2 size={14}/> Pagamento Aprovado
                             </span>
                             {f.receiptUrl && <span className="text-[11px] font-medium text-slate-500 mt-1.5 flex items-center gap-1 justify-end"><FileText size={12}/> Comprovante: {f.receiptUrl.startsWith('data:') ? 'Anexado no sistema' : f.receiptUrl}</span>}
                           </div>
                         ) : f.status === 'in_review' ? (
                           <div className="flex flex-col items-end">
                             <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 w-max ml-auto">
                               <Clock size={14}/> Em Análise
                             </span>
                             <span className="text-[11px] font-medium text-blue-600 mt-1.5">Aguardando aprovação do admin.</span>
                           </div>
                         ) : (
                           <div className="flex flex-col items-end">
                             <span className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 w-max ml-auto">
                               <Circle size={14}/> Aguardando Pagamento
                             </span>
                           </div>
                         )}
                       </td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ClientSettings() {
  const { currentUser, updateUserPreferences } = useContext(AppContext);
  
  const colors = [
    { name: 'Padrão (Cinza Claro)', class: 'bg-slate-200' },
    { name: 'Branco Puro', class: 'bg-white' },
    { name: 'Azul Suave', class: 'bg-blue-50' },
    { name: 'Verde Suave', class: 'bg-emerald-50' },
    { name: 'Quente Suave', class: 'bg-orange-50' }
  ];

  return (
    <div className="max-w-2xl bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Configurações de Visualização</h2>
        <p className="text-slate-500 text-sm mt-1">Personalize a aparência do seu portal.</p>
      </div>

      <div>
        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><PaintBucket size={18}/> Cor de Fundo do Portal</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {colors.map(color => (
            <button
              key={color.class}
              onClick={() => updateUserPreferences({ bgColor: color.class })}
              className={`p-4 border rounded-lg flex items-center justify-between transition-all ${
                currentUser.preferences?.bgColor === color.class ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="text-sm font-medium text-slate-700">{color.name}</span>
              <div className={`w-6 h-6 rounded-full border border-slate-300 ${color.class}`}></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Utility Components
function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <AlertCircle className="text-slate-300 mb-3" size={32} />
      <p className="text-slate-500 text-sm">{message}</p>
    </div>
  );
}

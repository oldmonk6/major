import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class test{
    public static void main(String[] args){
        List<Object>list=new ArrayList<>();
        for(int i=0;i<10;i++){
            list.add(i);
        }
    for(Object obj:list){
        System.out.println(obj);
    }
    Map<String,String>map=new HashMap<>();
    map.put("key1","value1");
    map.put(null, null);
    for(Map.Entry<String,String> entry:map.entrySet()){
        System.out.println(entry.getKey()+":"+entry.getValue());
    }

}
}